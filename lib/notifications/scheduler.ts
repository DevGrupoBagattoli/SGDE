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

  // Notification NÃO tem relação Prisma com Demand (só demandId escalar).
  // Duas queries no total (evita N+1 — o cron varre a cada minuto):
  // primeiro as demandas ativas, depois todas as notificações elegíveis de uma vez.
  const demands = await prisma.demand.findMany({
    where: { deletedAt: null, status: { in: [DemandStatus.PENDING, DemandStatus.IN_PROGRESS] } },
    select: {
      id: true,
      createdById: true,
      status: true,
      deletedAt: true,
      descricao: true,
      local: true,
      inicioPrevisto: true,
    },
  })

  const counters = { dispatched: 0, skipped: 0, failed: 0 }

  if (demands.length === 0) return counters

  const demandsById = new Map(demands.map((demand) => [demand.id, demand]))

  const notifications = await prisma.notification.findMany({
    where: {
      demandId: { in: demands.map((demand) => demand.id) },
      type: { in: [...DEMAND_EVENT_TYPES] },
      readAt: null,
      createdAt: { lte: threshold },
    },
    select: {
      id: true,
      demandId: true,
      userId: true,
      type: true,
      readAt: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  })

  for (const notification of notifications) {
    if (!notification.demandId) continue // demandId é nullable no schema; a query já filtra por demandas ativas
    const demand = demandsById.get(notification.demandId)
    if (!demand) continue

    if (!isEscalationCandidate(notification, demand, now, escalationHours)) continue
    if (notification.userId === demand.createdById) continue // criador não escalona a si mesmo

    // Idade REAL de não-leitura (não o threshold): "há 5h" quando está há 5h.
    const unseenHours = Math.max(
      1,
      Math.floor((now.getTime() - notification.createdAt.getTime()) / 3_600_000)
    )

    // REGISTRO (limitação conhecida): diferente da varredura principal (que
    // re-verifica a demanda antes de cada envio), aqui não há re-busca fresh —
    // a demanda pode virar DONE/CANCELLED/deleted entre o findMany e o dispatch.
    // Janela pequena e best-effort: o pior caso é um escalonamento extra;
    // o dedupeKey por notificationId impede repetição.

    // REGISTRO (design aceito): escalonamento é POR NOTIFICAÇÃO, não por demanda —
    // N notificações não lidas da mesma demanda geram N avisos ao criador
    // (decisão do stakeholder; rever se surgir fadiga de alerta).
    const outcome = await dispatchEvent({
      userId: demand.createdById,
      type: "DEMAND_UNSEEN_ESCALATION",
      priority: resolvePriority("DEMAND_UNSEEN_ESCALATION"),
      demandId: demand.id,
      content: buildNotificationContent("DEMAND_UNSEEN_ESCALATION", demand, {
        unseenUserName: notification.user.name,
        unseenHours,
      }),
      dedupeKey: `DEMAND_UNSEEN_ESCALATION:${notification.id}:${demand.createdById}`,
    })

    counters[outcome]++
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
    // A janela de tempo (upcoming/overdue) também é avaliada na linha fresh: um
    // reagendamento entre o findMany e aqui não pode disparar lembrete com horário antigo.
    const fresh = await prisma.demand.findUnique({ where: { id: demand.id } })

    if (
      !fresh ||
      fresh.deletedAt ||
      fresh.status === DemandStatus.DONE ||
      fresh.status === DemandStatus.CANCELLED
    ) {
      continue
    }

    const upcoming = isUpcomingCandidate(fresh, now, windowMinutes)
    const overdue = isOverdueCandidate(fresh, now, finishMaxHours)

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
    escalatedFailed: escalation.failed,
  }
}
