import { Demand, DemandStatus, Prisma, User, UserRole } from "@prisma/client"
import { z } from "zod"

import { formatDurationMinutes, parseDurationMinutes } from "@/lib/server/dates"

export const demandStatusFromDb = (status: DemandStatus) => {
  if (status === DemandStatus.PENDING) return "Pendente"
  if (status === DemandStatus.IN_PROGRESS) return "Em Andamento"
  if (status === DemandStatus.CANCELLED) return "Cancelado"
  return "Concluído"
}

export const demandStatusToDb = (status: string): DemandStatus => {
  if (status === "Pendente") return DemandStatus.PENDING
  if (status === "Em Andamento") return DemandStatus.IN_PROGRESS
  if (status === "Concluído") return DemandStatus.DONE
  if (status === "Cancelado") return DemandStatus.CANCELLED
  throw new Error("Status inválido")
}

type DemandWithRelations = Demand & {
  technician: User
  createdBy: User
  participants: Array<{ user: User }>
}

export const toDemandDto = (demand: DemandWithRelations) => {
  return {
    id: demand.id,
    tecnico: demand.technician.name,
    solicitante: demand.createdBy.name,
    equipe: demand.equipe,
    local: demand.local,
    descricao: demand.descricao,
    status: demandStatusFromDb(demand.status),
    horarioInicio: demand.inicioPrevisto.toISOString(),
    horarioFim: demand.fimPrevisto.toISOString(),
    duracaoPrevista: formatDurationMinutes(demand.duracaoMinutos),
    observacoes: demand.observacoes,
    participantes: demand.participants.map((participant) => participant.user.name),
    version: demand.version,
    dateKeys: [],
  }
}

export const createDemandSchema = z.object({
  tecnico: z.string().min(2),
  equipe: z.string().min(1),
  local: z.string().min(3),
  descricao: z.string().min(3),
  horarioInicio: z.iso.datetime(),
  duracaoPrevista: z.string().regex(/^\d{2}:\d{2}h$/),
  status: z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]),
  observacoes: z.string().optional().default(""),
  participantes: z.array(z.string()).optional().default([]),
})

export const updateStatusSchema = z.object({
  status: z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]),
  version: z.number().int().positive(),
})

export const updateDescricaoSchema = z.object({
  descricao: z.string().min(3),
  version: z.number().int().positive(),
})

export const updateDescricaoSchema = z.object({
  descricao: z.string().min(3),
  version: z.number().int().positive(),
})

export const updateScheduleSchema = z.object({
  horarioInicio: z.iso.datetime(),
  duracaoPrevista: z.string().regex(/^\d{2}:\d{2}h$/),
  observacoes: z.string().default(""),
  participantes: z.array(z.string()).default([]),
  version: z.number().int().positive(),
})

export const parseCreateDemandData = (input: z.infer<typeof createDemandSchema>) => {
  const start = new Date(input.horarioInicio)
  const durationMinutes = parseDurationMinutes(input.duracaoPrevista)
  const end = new Date(start.getTime() + durationMinutes * 60_000)

  if (end.getTime() <= start.getTime()) {
    throw new Error("Intervalo inválido")
  }

  return {
    start,
    end,
    durationMinutes,
    dbStatus: demandStatusToDb(input.status),
  }
}

export const parseScheduleUpdateData = (
  previousStartIso: string,
  previousEndIso: string,
  input: z.infer<typeof updateScheduleSchema>
) => {
  const start = new Date(input.horarioInicio)
  const durationMinutes = parseDurationMinutes(input.duracaoPrevista)
  const end = new Date(start.getTime() + durationMinutes * 60_000)

  if (end.getTime() <= start.getTime()) {
    throw new Error("Intervalo inválido")
  }

  const moved =
    start.toISOString() !== previousStartIso ||
    end.toISOString() !== previousEndIso

  if (moved && !input.observacoes.trim()) {
    throw new Error("Informe observações para justificar o remanejamento")
  }

  return {
    start,
    end,
    durationMinutes,
    moved,
  }
}

export const demandsWhereForUser = (user: User): Prisma.DemandWhereInput => {
  if (user.role === UserRole.MANAGER) {
    return { deletedAt: null }
  }

  return {
    deletedAt: null,
    OR: [
      { technicianId: user.id },
      { participants: { some: { userId: user.id } } },
    ],
  }
}
