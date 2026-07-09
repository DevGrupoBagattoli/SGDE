import { UserRole } from "@prisma/client"

import { canEditDemand, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import { toDemandDto, updateScheduleSchema, parseScheduleUpdateData } from "@/lib/server/demands"
import { jsonError, jsonOk, jsonValidationError, type ApiWarning } from "@/lib/server/http"
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

  const overlapCount = await prisma.demand.count({
    where: {
      id: {
        not: demand.id,
      },
      technicianId: demand.technicianId,
      inicioPrevisto: {
        lte: parsedDate.end,
      },
      fimPrevisto: {
        gte: parsedDate.start,
      },
    },
  })

  const warnings: ApiWarning[] =
    overlapCount > 0
      ? [
          {
            code: "SCHEDULE_CONFLICT",
            message: "Existe possível conflito de agenda para o técnico responsável.",
          },
        ]
      : []

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

  return jsonOk(
    {
      demand: {
        ...dto,
        dateKeys: enumerateDateKeysUtc(updated.inicioPrevisto, updated.fimPrevisto),
      },
    },
    warnings
  )
}
