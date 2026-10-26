import { DemandStatus } from "@prisma/client"

import { buildNotificationContent } from "@/lib/notifications/content"
import { notify } from "@/lib/notifications/dispatcher"
import {
  addMinutes,
  buildDedupeKey,
  isOverdueCandidate,
  isUpcomingCandidate,
  resolveRecipients,
} from "@/lib/notifications/events"
import type { NotificationInput } from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

const DEFAULT_WINDOW_MINUTES = 15

/** Parse seguro: env ausente, NaN ou <= 0 cai no default (env inválida não desliga o lembrete). */
const resolveWindowMinutes = (): number => {
  const parsed = Number(process.env.NOTIFY_UPCOMING_MINUTES)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MINUTES
}

type DispatchOutcome = "dispatched" | "skipped" | "failed"

/** Isola falhas por evento: uma exceção no notify não pode abortar a varredura inteira. */
const dispatchEvent = async (input: NotificationInput): Promise<DispatchOutcome> => {
  try {
    const result = await notify(input)

    return result.skipped ? "skipped" : "dispatched"
  } catch {
    return "failed"
  }
}

export const dispatchPendingNotifications = async (now = new Date()) => {
  const windowMinutes = resolveWindowMinutes()

  const demands = await prisma.demand.findMany({
    where: {
      deletedAt: null,
      status: { in: [DemandStatus.PENDING, DemandStatus.IN_PROGRESS] },
      OR: [
        // janela upcoming: (now, now + windowMinutes]
        { inicioPrevisto: { gt: now, lte: addMinutes(now, windowMinutes) } },
        { fimPrevisto: { lt: now } },
      ],
    },
    include: { technician: true, participants: { include: { user: true } } },
  })

  const counters = { dispatched: 0, skipped: 0, failed: 0 }

  for (const demand of demands) {
    // ANTI-CORRIDA: re-busca a demanda antes de notificar; se virou DONE/CANCELLED/deleted → pula.
    const fresh = await prisma.demand.findUnique({ where: { id: demand.id } })

    if (
      !fresh ||
      fresh.deletedAt ||
      fresh.status === DemandStatus.DONE ||
      fresh.status === DemandStatus.CANCELLED
    ) {
      continue
    }

    const upcoming = isUpcomingCandidate(demand, now, windowMinutes)
    const overdue = isOverdueCandidate(demand, now)

    for (const recipient of resolveRecipients(demand)) {
      if (upcoming) {
        const outcome = await dispatchEvent({
          userId: recipient.id,
          type: "SERVICE_UPCOMING",
          priority: "NORMAL",
          demandId: demand.id,
          content: buildNotificationContent("SERVICE_UPCOMING", demand),
          dedupeKey: buildDedupeKey("SERVICE_UPCOMING", demand.id, recipient.id),
        })

        counters[outcome]++
      }

      if (overdue) {
        const outcome = await dispatchEvent({
          userId: recipient.id,
          type: "SERVICE_FINISH_REMINDER",
          priority: "NORMAL",
          demandId: demand.id,
          content: buildNotificationContent("SERVICE_FINISH_REMINDER", demand),
          dedupeKey: buildDedupeKey("SERVICE_FINISH_REMINDER", demand.id, recipient.id),
        })

        counters[outcome]++
      }
    }
  }

  return counters
}
