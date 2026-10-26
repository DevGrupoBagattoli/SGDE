import { DemandStatus } from "@prisma/client"

import { buildNotificationContent } from "@/lib/notifications/content"
import { notify } from "@/lib/notifications/dispatcher"
import {
  addHours,
  addMinutes,
  buildDedupeKey,
  buildRecurringDedupeKey,
  DEMAND_EVENT_TYPES,
  hourBucket,
  isEscalationCandidate,
  isOverdueCandidate,
  isUpcomingCandidate,
  resolvePriority,
  resolveRecipients,
} from "@/lib/notifications/events"
import type { NotificationInput } from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

const DEFAULT_WINDOW_MINUTES = 15
const DEFAULT_ESCALATION_HOURS = 2
const DEFAULT_FINISH_MAX_HOURS = 24

/** Parse seguro: env ausente, NaN ou <= 0 cai no default (env inválida não desliga o lembrete). */
const resolveWindowMinutes = (): number => {
  const parsed = Number(process.env.NOTIFY_UPCOMING_MINUTES)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MINUTES
}

const resolveEscalationHours = (): number => {
  const parsed = Number(process.env.NOTIFY_ESCALATION_HOURS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ESCALATION_HOURS
}

const resolveFinishMaxHours = (): number => {
  const parsed = Number(process.env.NOTIFY_FINISH_MAX_HOURS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FINISH_MAX_HOURS
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

/** Notifica o CRIADOR sobre eventos de demanda não lidos há thresholdHours (demanda ainda ativa). */
const escalateUnseenNotifications = async (now: Date) => {
  const escalationHours = resolveEscalationHours()
  const threshold = addHours(now, -escalationHours)

  // Notification NÃO tem relação Prisma com Demand (só demandId escalar):
  // parte das demandas ativas e busca as notificações não lidas de cada uma.
  const demands = await prisma.demand.findMany({
    where: { deletedAt: null, status: { in: [DemandStatus.PENDING, DemandStatus.IN_PROGRESS] } },
    include: { technician: true },
  })

  const counters = { dispatched: 0, skipped: 0, failed: 0 }

  for (const demand of demands) {
    const notifications = await prisma.notification.findMany({
      where: {
        demandId: demand.id,
        type: { in: [...DEMAND_EVENT_TYPES] },
        readAt: null,
        createdAt: { lte: threshold },
      },
      select: { id: true, userId: true, type: true, readAt: true, createdAt: true },
    })

    for (const notification of notifications) {
      if (!isEscalationCandidate(notification, demand, now, escalationHours)) continue
      if (notification.userId === demand.createdById) continue // criador não escalona a si mesmo

      const outcome = await dispatchEvent({
        userId: demand.createdById,
        type: "DEMAND_UNSEEN_ESCALATION",
        priority: resolvePriority("DEMAND_UNSEEN_ESCALATION"),
        demandId: demand.id,
        content: buildNotificationContent("DEMAND_UNSEEN_ESCALATION", demand, {
          technicianName: demand.technician.name,
          unseenHours: escalationHours,
        }),
        dedupeKey: `DEMAND_UNSEEN_ESCALATION:${notification.id}:${demand.createdById}`,
      })

      counters[outcome]++
    }
  }

  return counters
}

export const dispatchPendingNotifications = async (now = new Date()) => {
  const windowMinutes = resolveWindowMinutes()
  const finishMaxHours = resolveFinishMaxHours()

  const demands = await prisma.demand.findMany({
    where: {
      deletedAt: null,
      status: { in: [DemandStatus.PENDING, DemandStatus.IN_PROGRESS] },
      OR: [
        // janela upcoming: (now, now + windowMinutes]
        { inicioPrevisto: { gt: now, lte: addMinutes(now, windowMinutes) } },
        { fimPrevisto: { lt: now, gt: addHours(now, -finishMaxHours) } },
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
    const overdue = isOverdueCandidate(demand, now, finishMaxHours)

    for (const recipient of resolveRecipients(demand)) {
      if (upcoming) {
        const outcome = await dispatchEvent({
          userId: recipient.id,
          type: "SERVICE_UPCOMING",
          priority: resolvePriority("SERVICE_UPCOMING"),
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
          priority: resolvePriority("SERVICE_FINISH_REMINDER"),
          demandId: demand.id,
          content: buildNotificationContent("SERVICE_FINISH_REMINDER", demand),
          dedupeKey: buildRecurringDedupeKey(
            "SERVICE_FINISH_REMINDER",
            demand.id,
            recipient.id,
            hourBucket(now)
          ),
        })

        counters[outcome]++
      }
    }
  }

  const escalation = await escalateUnseenNotifications(now)

  return {
    dispatched: counters.dispatched,
    skipped: counters.skipped,
    failed: counters.failed,
    escalated: escalation.dispatched,
    escalatedSkipped: escalation.skipped,
  }
}
