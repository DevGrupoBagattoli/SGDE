import { canViewDemand, requireAuth, roleFromDb } from "@/lib/server/auth"
import { jsonError, jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params

  const demand = await prisma.demand.findUnique({
    where: { id },
    include: {
      participants: true,
    },
  })

  if (!demand) {
    return jsonError(404, "NOT_FOUND", "Demanda não encontrada para o identificador informado", {
      demandId: id,
    })
  }

  if (!canViewDemand(auth.user, demand)) {
    return jsonError(403, "FORBIDDEN", "Usuário autenticado sem permissão para visualizar esta demanda", {
      demandId: id,
      userId: auth.user.id,
      reason: "A demanda não pertence ao usuário e não há privilégio de gestor",
    })
  }

  const history = await prisma.demandAudit.findMany({
    where: { demandId: id },
    orderBy: { createdAt: "desc" },
    include: {
      actor: true,
    },
  })

  return jsonOk({
    history: history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      field: entry.field,
      previousValue: entry.previousValue,
      nextValue: entry.nextValue,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
      actor: {
        name: entry.actor.name,
        role: roleFromDb(entry.actor.role),
      },
    })),
  })
}
