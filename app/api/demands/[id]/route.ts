import { UserRole } from "@prisma/client"

import { requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { jsonError, jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
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
