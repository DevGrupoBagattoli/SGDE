import { DemandStatus, User } from "@prisma/client"

import {
  findScheduleConflicts,
  type ConflictCandidate,
  type ScheduleConflict,
  type ScheduleConflictDto,
} from "@/lib/demands"
import { canViewDemand } from "@/lib/server/auth"
import { prisma } from "@/lib/server/prisma"
import { formatAppDateTimeRange } from "@/lib/timezone"

/** Marca o 409 de agenda e o distingue do 409 de versão desatualizada. */
export const SCHEDULE_CONFLICT_REASON = "SCHEDULE_CONFLICT"

export const ACTIVE_DEMAND_STATUSES: DemandStatus[] = [
  DemandStatus.PENDING,
  DemandStatus.IN_PROGRESS,
]

export const isActiveDemandStatus = (status: DemandStatus) =>
  ACTIVE_DEMAND_STATUSES.includes(status)

type ConflictQuery = {
  start: Date
  end: Date
  userIds: string[]
  excludeDemandId?: string
}

export const detectScheduleConflicts = async (
  viewer: User,
  { start, end, userIds, excludeDemandId }: ConflictQuery
) => {
  if (userIds.length === 0) {
    return { conflicts: [] as ScheduleConflict[], visible: [] as ScheduleConflictDto[] }
  }

  const rows = await prisma.demand.findMany({
    where: {
      deletedAt: null,
      status: { in: ACTIVE_DEMAND_STATUSES },
      ...(excludeDemandId ? { id: { not: excludeDemandId } } : {}),
      inicioPrevisto: { lt: end },
      fimPrevisto: { gt: start },
      OR: [
        { technicianId: { in: userIds } },
        { participants: { some: { userId: { in: userIds } } } },
      ],
    },
    include: {
      technician: true,
      participants: { include: { user: true } },
    },
  })

  const candidates: ConflictCandidate[] = rows.map((row) => ({
    id: row.id,
    local: row.local,
    status: row.status,
    deletedAt: row.deletedAt,
    inicioPrevisto: row.inicioPrevisto,
    fimPrevisto: row.fimPrevisto,
    people: [
      { userId: row.technician.id, userName: row.technician.name },
      ...row.participants.map((p) => ({ userId: p.user.id, userName: p.user.name })),
    ],
  }))

  const conflicts = findScheduleConflicts({ start, end, userIds, excludeDemandId, candidates })
  const viewable = new Set(rows.filter((row) => canViewDemand(viewer, row)).map((row) => row.id))

  const visible = conflicts.map((conflict): ScheduleConflictDto =>
    viewable.has(conflict.demandId)
      ? {
          userId: conflict.userId,
          userName: conflict.userName,
          demandId: conflict.demandId,
          local: conflict.local,
          inicio: conflict.inicio.toISOString(),
          fim: conflict.fim.toISOString(),
          restrito: false,
        }
      : {
          userId: conflict.userId,
          userName: conflict.userName,
          demandId: null,
          local: null,
          inicio: null,
          fim: null,
          restrito: true,
        }
  )

  return { conflicts, visible }
}

const describeConflict = (conflict: ScheduleConflictDto) =>
  conflict.restrito || !conflict.inicio || !conflict.fim
    ? `${conflict.userName} (ocupado(a) em outro chamado)`
    : `${conflict.userName} em ${conflict.local} (${formatAppDateTimeRange(new Date(conflict.inicio), new Date(conflict.fim))})`

export const conflictMessage = (conflicts: ScheduleConflictDto[]) =>
  `Este horário está ocupado por uma atividade já marcada: ${conflicts.map(describeConflict).join("; ")}.`

/** Resumo gravado na auditoria; sai sempre do cálculo do servidor, com todos os detalhes. */
export const conflictAuditSummary = (conflicts: ScheduleConflict[]) =>
  conflicts
    .map(
      (conflict) =>
        `${conflict.userName} em ${conflict.local} (${formatAppDateTimeRange(conflict.inicio, conflict.fim)}, chamado ${conflict.demandId})`
    )
    .join("; ")

export type ConflictResolution =
  | { status: "free" }
  | { status: "needs-confirmation"; visible: ScheduleConflictDto[]; message: string }
  | { status: "confirmed"; auditSummary: string }

/**
 * Decisão única para criar e remanejar. O servidor sempre recalcula: a flag
 * `confirmar` só importa quando há conflito de fato, e o resumo auditado vem
 * daqui, nunca do cliente.
 */
export const resolveScheduleConflicts = async (
  viewer: User,
  query: ConflictQuery & { confirmar: boolean }
): Promise<ConflictResolution> => {
  const { conflicts, visible } = await detectScheduleConflicts(viewer, query)

  if (conflicts.length === 0) {
    return { status: "free" }
  }

  if (!query.confirmar) {
    return { status: "needs-confirmation", visible, message: conflictMessage(visible) }
  }

  return { status: "confirmed", auditSummary: conflictAuditSummary(conflicts) }
}
