import { DemandStatus } from "@prisma/client"

import type { DemandEventType, NotificationEventType, Priority } from "@/lib/notifications/types"

export const buildDedupeKey = (
  type: NotificationEventType,
  demandId: string,
  userId: string
): string => `${type}:${demandId}:${userId}`

/** Soma minutos a um instante sem dependências externas (datas são instantes UTC). */
export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000)

export type UpcomingCandidateDemand = {
  status: DemandStatus
  deletedAt: Date | null
  inicioPrevisto: Date
}

/** Demanda dentro da janela do lembrete de início: (now, now + windowMinutes]. */
export const isUpcomingCandidate = (
  demand: UpcomingCandidateDemand,
  now: Date,
  windowMinutes: number
): boolean =>
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  demand.inicioPrevisto > now &&
  demand.inicioPrevisto <= addMinutes(now, windowMinutes)

/** Os 6 eventos de mutação de demanda (escalonáveis quando não lidos). */
export const DEMAND_EVENT_TYPES = [
  "DEMAND_CREATED",
  "DEMAND_SCHEDULE_CHANGED",
  "DEMAND_STATUS_CHANGED",
  "DEMAND_CANCELLED",
  "DEMAND_DESCRIPTION_CHANGED",
  "DEMAND_DELETED",
] as const satisfies readonly DemandEventType[]

/** Soma horas a um instante (espelho de addMinutes). */
export const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * 3_600_000)

/** Bucket de hora para dedupeKey recorrente (determinístico, sem fuso). */
export const hourBucket = (date: Date): number => Math.floor(date.getTime() / 3_600_000)

/** Destinatários sem o autor da ação (quem fez não precisa ser notificado). */
export const excludeActor = <T extends { id: string }>(recipients: T[], actorId: string): T[] =>
  recipients.filter((recipient) => recipient.id !== actorId)

/**
 * Prioridade centralizada (decisão do stakeholder: tudo CRITICAL exceto ack).
 * Futuro (urgência por demanda): mudar APENAS aqui.
 */
export const resolvePriority = (type: NotificationEventType): Priority =>
  type === "DEMAND_ACK_CONFIRMED" ? "NORMAL" : "CRITICAL"

/** dedupeKey de evento de demanda: única por mutação (version sobe a cada update). */
export const buildDemandEventDedupeKey = (
  type: DemandEventType,
  demandId: string,
  userId: string,
  version: number
): string => `${type}:${demandId}:${userId}:v${version}`

/** dedupeKey recorrente: única por hora (re-disparo do lembrete de finalização). */
export const buildRecurringDedupeKey = (
  type: NotificationEventType,
  demandId: string,
  userId: string,
  bucket: number
): string => `${type}:${demandId}:${userId}:${bucket}`

export type OverdueCandidateDemand = {
  status: DemandStatus
  deletedAt: Date | null
  fimPrevisto: Date
}

/** Demanda com fim previsto vencido e ainda não finalizada/cancelada. Teto: maxHours após o fim previsto. */
export const isOverdueCandidate = (
  demand: OverdueCandidateDemand,
  now: Date,
  maxHours?: number
): boolean =>
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  demand.fimPrevisto < now &&
  (maxHours === undefined || demand.fimPrevisto > addHours(now, -maxHours))

/** Notificação de evento de demanda elegível a escalonamento (não lida há thresholdHours, demanda ativa). */
export const isEscalationCandidate = (
  notification: { type: NotificationEventType; readAt: Date | null; createdAt: Date },
  demand: { status: DemandStatus; deletedAt: Date | null },
  now: Date,
  thresholdHours: number
): boolean =>
  notification.readAt === null &&
  (DEMAND_EVENT_TYPES as readonly string[]).includes(notification.type) &&
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  notification.createdAt.getTime() <= now.getTime() - thresholdHours * 3_600_000

export type RecipientRef = { id: string }

export type DemandRecipientsInput = {
  technician: RecipientRef
  participants: Array<{ user: RecipientRef }>
}

/** Técnico responsável + participantes, sem duplicar quem é os dois. */
export const resolveRecipients = (demand: DemandRecipientsInput): RecipientRef[] => {
  const recipients = [
    demand.technician,
    ...demand.participants.map((participant) => participant.user),
  ]

  const seen = new Set<string>()

  return recipients.filter((recipient) => {
    if (seen.has(recipient.id)) return false
    seen.add(recipient.id)
    return true
  })
}
