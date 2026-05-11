import { UserRole } from "@prisma/client"

import { canEditDemand, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import { toDemandDto, updateStatusSchema, demandStatusToDb } from "@/lib/server/demands"
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
  const parsed = updateStatusSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  const demand = await prisma.demand.findUnique({
    where: { id },
    include: {
      technician: true,
      participants: { include: { user: true } },
    },
  })

  if (!demand) {
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

  const nextStatus = demandStatusToDb(parsed.data.status)

  const updated = await prisma.demand.update({
    where: { id: demand.id },
    data: {
      status: nextStatus,
      version: {
        increment: 1,
      },
      audits: {
        create: {
          actorUserId: auth.user.id,
          action: "UPDATE_STATUS",
          field: "status",
          previousValue: demand.status,
          nextValue: nextStatus,
          reason: null,
        },
      },
    },
    include: {
      technician: true,
      participants: { include: { user: true } },
    },
  })

  const dto = toDemandDto(updated)

  return jsonOk({
    demand: {
      ...dto,
      dateKeys: enumerateDateKeysUtc(updated.inicioPrevisto, updated.fimPrevisto),
    },
  })
}
