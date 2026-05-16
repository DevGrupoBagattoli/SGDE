import { UserRole } from "@prisma/client"

import { canEditDemand, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import { toDemandDto, updateDescricaoSchema } from "@/lib/server/demands"
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
  const parsed = updateDescricaoSchema.safeParse(payload)

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
      reason: "Somente gestor ou técnico responsável podem editar",
    })
  }

  if (parsed.data.version !== demand.version) {
    return jsonError(409, "CONFLICT", "Versão desatualizada da demanda; atualize os dados antes de salvar", {
      sentVersion: parsed.data.version,
      currentVersion: demand.version,
    })
  }

  const updated = await prisma.demand.update({
    where: { id },
    data: {
      descricao: parsed.data.descricao,
      version: { increment: 1 },
      audits: {
        create: {
          actorUserId: auth.user.id,
          action: "UPDATE",
          field: "descricao",
          previousValue: demand.descricao,
          nextValue: parsed.data.descricao,
          reason: null,
        },
      },
    },
    include: {
      technician: true,
      createdBy: true,
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  if (auth.user.role !== UserRole.MANAGER) {
    return jsonError(403, "FORBIDDEN", "Somente gestores podem excluir demandas", {
      userId: auth.user.id,
      actualRole: auth.user.role,
    })
  }

  const { id } = await params

  const demand = await prisma.demand.findUnique({
    where: { id },
  })

  if (!demand) {
    return jsonError(404, "NOT_FOUND", "Demanda não encontrada para o identificador informado", {
      demandId: id,
    })
  }

  await prisma.demand.delete({ where: { id } })

  return jsonOk({ deleted: true, demandId: id })
}
