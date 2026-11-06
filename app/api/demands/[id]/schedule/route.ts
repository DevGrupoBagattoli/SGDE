import { UserRole } from "@prisma/client"

import { notifyDemandEvent } from "@/lib/notifications/demand-events"
import { canEditDemand, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { enumerateDateKeysInAppTz } from "@/lib/timezone"
import {
  findBlockingScheduleConflicts,
  isActiveDemandStatus,
  SCHEDULE_CONFLICT_REASON,
} from "@/lib/server/demand-conflicts"
import {
  demandStatusToDb,
  parseScheduleUpdateData,
  toDemandDto,
  updateScheduleSchema,
} from "@/lib/server/demands"
import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params

  const payload = await request.json().catch(() => null)
  const parsed = updateScheduleSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  const demand = await prisma.demand.findUnique({
    where: { id },
    include: {
      technician: true,
      participants: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!demand || demand.deletedAt) {
    return jsonError(404, "NOT_FOUND", "Demanda não encontrada para o identificador informado", {
      demandId: id,
    })
  }

  if (!canEditDemand(auth.user, demand)) {
    return jsonError(403, "FORBIDDEN", "Usuário autenticado sem permissão para editar esta demanda", {
      demandId: id,
      userId: auth.user.id,
      reason: "Somente gestor, técnico responsável ou regras de edição aplicáveis podem editar",
    })
  }

  if (
    auth.user.role === UserRole.ELECTRICIAN &&
    demand.technicianId !== auth.user.id
  ) {
    return jsonError(403, "FORBIDDEN", "Participantes possuem acesso somente de visualização para esta demanda", {
      demandId: id,
      userId: auth.user.id,
      technicianId: demand.technicianId,
    })
  }

  if (parsed.data.version !== demand.version) {
    return jsonError(409, "CONFLICT", "Versão desatualizada da demanda; atualize os dados antes de salvar", {
      sentVersion: parsed.data.version,
      currentVersion: demand.version,
    })
  }

  let parsedDate

  try {
    parsedDate = parseScheduleUpdateData(
      demand.inicioPrevisto.toISOString(),
      demand.fimPrevisto.toISOString(),
      parsed.data
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos"
    return jsonError(422, "UNPROCESSABLE", `Não foi possível validar os dados de agenda: ${message}`, {
      reason: message,
      fields: ["horarioInicio", "duracaoPrevista", "observacoes", "participantes"],
    })
  }

  const participants = await prisma.user.findMany({
    where: {
      role: UserRole.ELECTRICIAN,
      name: {
        in: parsed.data.participantes.filter((name) => name !== demand.technician.name),
      },
    },
  })

  // Status que o chamado terá ao salvar (a troca em si é feita pela rota de status).
  const effectiveStatus = parsed.data.status
    ? demandStatusToDb(parsed.data.status)
    : demand.status
  const currentParticipantIds = new Set(demand.participants.map((p) => p.userId))
  const addsPeople = participants.some((p) => !currentParticipantIds.has(p.id))
  const reactivates =
    !isActiveDemandStatus(demand.status) && isActiveDemandStatus(effectiveStatus)

  // Só checa quando algo que afeta a ocupação muda; senão editar uma observação
  // ficaria travado por um conflito que já existia antes.
  if (
    isActiveDemandStatus(effectiveStatus) &&
    (parsedDate.moved || addsPeople || reactivates)
  ) {
    const blocking = await findBlockingScheduleConflicts(auth.user, {
      start: parsedDate.start,
      end: parsedDate.end,
      userIds: [demand.technicianId, ...participants.map((p) => p.id)],
      excludeDemandId: demand.id,
    })

    if (blocking) {
      return jsonError(409, "CONFLICT", blocking.message, {
        reason: SCHEDULE_CONFLICT_REASON,
        conflitos: blocking.visible,
      })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.demandParticipant.deleteMany({
      where: { demandId: demand.id },
    })

    const updatedDemand = await tx.demand.update({
      where: { id: demand.id },
      data: {
        inicioPrevisto: parsedDate.start,
        fimPrevisto: parsedDate.end,
        duracaoMinutos: parsedDate.durationMinutes,
        observacoes: parsed.data.observacoes.trim(),
        version: {
          increment: 1,
        },
        participants: {
          create: participants.map((participant) => ({
            userId: participant.id,
          })),
        },
      },
      include: {
        technician: true,
        createdBy: true,
        participants: {
          include: {
            user: true,
          },
        },
      },
    })

    await tx.demandAudit.createMany({
      data: [
        {
          demandId: demand.id,
          actorUserId: auth.user.id,
          action: "UPDATE_SCHEDULE",
          field: "inicioPrevisto",
          previousValue: demand.inicioPrevisto.toISOString(),
          nextValue: parsedDate.start.toISOString(),
          reason: parsed.data.observacoes.trim() || null,
        },
        {
          demandId: demand.id,
          actorUserId: auth.user.id,
          action: "UPDATE_SCHEDULE",
          field: "fimPrevisto",
          previousValue: demand.fimPrevisto.toISOString(),
          nextValue: parsedDate.end.toISOString(),
          reason: parsed.data.observacoes.trim() || null,
        },
        {
          demandId: demand.id,
          actorUserId: auth.user.id,
          action: "UPDATE_SCHEDULE",
          field: "participantes",
          previousValue: demand.participants.map((p) => p.user.name).join(", "),
          nextValue: participants.map((p) => p.name).join(", "),
          reason: parsed.data.observacoes.trim() || null,
        },
      ],
    })

    return updatedDemand
  })

  const dto = toDemandDto(updated)

  await notifyDemandEvent({
    type: "DEMAND_SCHEDULE_CHANGED",
    demand: updated,
    actorId: auth.user.id,
    actorName: auth.user.name,
  })

  return jsonOk(
    {
      demand: {
        ...dto,
        dateKeys: enumerateDateKeysInAppTz(updated.inicioPrevisto, updated.fimPrevisto),
      },
    }
  )
}
