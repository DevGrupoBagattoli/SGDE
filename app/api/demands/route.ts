import { UserRole } from "@prisma/client"
import { z } from "zod"

import { canViewDemand, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import {
  createDemandSchema,
  demandsWhereForUser,
  parseCreateDemandData,
  toDemandDto,
} from "@/lib/server/demands"
import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

const querySchema = z.object({
  tecnico: z.string().optional(),
  status: z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]).optional(),
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional(),
})

export async function GET(request: Request) {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const parsedUrl = new URL(request.url)
  const statusParam = parsedUrl.searchParams.get("status")
  const queryParsed = querySchema.safeParse({
    tecnico: parsedUrl.searchParams.get("tecnico") ?? undefined,
    status: (statusParam ?? undefined) as
      | "Pendente"
      | "Em Andamento"
      | "Concluído"
      | "Cancelado"
      | undefined,
    inicio: parsedUrl.searchParams.get("inicio") ?? undefined,
    fim: parsedUrl.searchParams.get("fim") ?? undefined,
  })

  if (!queryParsed.success) {
    return jsonValidationError(
      "Valores inválido nos parâmetros de consulta",
      queryParsed.error.flatten()
    )
  }

  const where = demandsWhereForUser(auth.user)
  const andWhere: Array<Record<string, unknown>> = [where]

  if (queryParsed.data.tecnico) {
    andWhere.push({
      technician: {
        name: queryParsed.data.tecnico,
      },
    })
  }

  if (queryParsed.data.status) {
    const map = {
      Pendente: "PENDING",
      "Em Andamento": "IN_PROGRESS",
      Concluído: "DONE",
      Cancelado: "CANCELLED",
    } as const

    andWhere.push({
      status: map[queryParsed.data.status],
    })
  }

  if (queryParsed.data.inicio || queryParsed.data.fim) {
    const start = queryParsed.data.inicio ? new Date(queryParsed.data.inicio) : new Date("1970-01-01T00:00:00.000Z")
    const end = queryParsed.data.fim ? new Date(queryParsed.data.fim) : new Date("3000-01-01T00:00:00.000Z")

    andWhere.push({
      inicioPrevisto: {
        lte: end,
      },
    })

    andWhere.push({
      fimPrevisto: {
        gte: start,
      },
    })
  }

  const demands = await prisma.demand.findMany({
    where: {
      AND: andWhere,
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
    orderBy: {
      inicioPrevisto: "asc",
    },
  })

  const data = demands
    .filter((demand) => canViewDemand(auth.user, demand))
    .map((demand) => {
      const dto = toDemandDto(demand)
      return {
        ...dto,
        dateKeys: enumerateDateKeysUtc(demand.inicioPrevisto, demand.fimPrevisto),
      }
    })

  return jsonOk({
    demands: data,
  })
}

export async function POST(request: Request) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  if (auth.user.role !== UserRole.MANAGER) {
    return jsonError(403, "FORBIDDEN", "Apenas usuários com perfil de gestor podem criar demandas", {
      role: auth.user.role,
      requiredRole: UserRole.MANAGER,
    })
  }

  const payload = await request.json().catch(() => null)
  const parsed = createDemandSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  const technician = await prisma.user.findUnique({
    where: { name: parsed.data.tecnico },
  })

  if (!technician || technician.role !== UserRole.ELECTRICIAN) {
    return jsonError(422, "UNPROCESSABLE", "Técnico inválido ou inexistente para a demanda informada", {
      tecnico: parsed.data.tecnico,
      reason: "O usuário informado não foi encontrado ou não possui perfil de eletricista",
    })
  }

  const participants = await prisma.user.findMany({
    where: {
      role: UserRole.ELECTRICIAN,
      name: {
        in: parsed.data.participantes.filter((name) => name !== parsed.data.tecnico),
      },
    },
  })

  let parsedDate

  try {
    parsedDate = parseCreateDemandData(parsed.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos"
    return jsonError(422, "UNPROCESSABLE", `Não foi possível interpretar os dados de agenda: ${message}`, {
      reason: message,
      fields: ["horarioInicio", "duracaoPrevista", "status", "observacoes"],
    })
  }

  const created = await prisma.demand.create({
    data: {
      technicianId: technician.id,
      equipe: parsed.data.equipe,
      local: parsed.data.local,
      descricao: parsed.data.descricao,
      status: parsedDate.dbStatus,
      inicioPrevisto: parsedDate.start,
      fimPrevisto: parsedDate.end,
      duracaoMinutos: parsedDate.durationMinutes,
      observacoes: parsed.data.observacoes,
      createdById: auth.user.id,
      participants: {
        create: participants.map((participant) => ({
          userId: participant.id,
        })),
      },
      audits: {
        create: {
          actorUserId: auth.user.id,
          action: "CREATE",
          field: "*",
          previousValue: null,
          nextValue: "Demanda criada",
          reason: parsed.data.observacoes || null,
        },
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

  const dto = toDemandDto(created)

  return jsonOk(
    {
      demand: {
        ...dto,
        dateKeys: enumerateDateKeysUtc(created.inicioPrevisto, created.fimPrevisto),
      },
    },
    []
  )
}
