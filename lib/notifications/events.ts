import { DemandStatus } from "@prisma/client"

import type { NotificationEventType } from "@/lib/notifications/types"

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

export type OverdueCandidateDemand = {
  status: DemandStatus
  deletedAt: Date | null
  fimPrevisto: Date
}

/** Demanda com fim previsto vencido e ainda não finalizada/cancelada. */
export const isOverdueCandidate = (
  demand: OverdueCandidateDemand,
  now: Date
): boolean =>
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  demand.fimPrevisto < now

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
