import { DemandStatus, User } from "@prisma/client"

import {
  findScheduleConflicts,
  type ConflictCandidate,
  type ScheduleConflict,
  type ScheduleConflictDto,
} from "@/lib/demands"
import { canViewDemand } from "@/lib/server/auth"
import type { ApiWarning } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"
import { formatAppDateTimeRange } from "@/lib/timezone"

export const SCHEDULE_CONFLICT_CODE = "SCHEDULE_CONFLICT"

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

/**
 * Usada ao criar e remanejar: o chamado é salvo normalmente e, se alguém já
 * estava ocupado no horário, a resposta leva este aviso. `null` quando está livre.
 */
export const scheduleConflictWarning = async (
  viewer: User,
  query: ConflictQuery
): Promise<ApiWarning | null> => {
  const { conflicts, visible } = await detectScheduleConflicts(viewer, query)

  return conflicts.length === 0
    ? null
    : { code: SCHEDULE_CONFLICT_CODE, message: conflictMessage(visible) }
}
