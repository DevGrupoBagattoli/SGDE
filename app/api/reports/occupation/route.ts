import { z } from "zod"

import { requireManager } from "@/lib/server/auth"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import { jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

const querySchema = z.object({
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  tecnico: z
    .union([z.string(), z.array(z.string())])
    .optional(),
  equipe: z.string().optional(),
})

export async function GET(request: Request) {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const url = new URL(request.url)

  const rawTecnico = url.searchParams.getAll("tecnico")
  const queryParsed = querySchema.safeParse({
    inicio: url.searchParams.get("inicio"),
    fim: url.searchParams.get("fim"),
    tecnico: rawTecnico.length === 1 ? rawTecnico[0] : rawTecnico.length > 1 ? rawTecnico : undefined,
    equipe: url.searchParams.get("equipe") ?? undefined,
  })

  if (!queryParsed.success) {
    return jsonValidationError(
      "Parâmetros de consulta inválidos. `inicio` e `fim` são obrigatórios.",
      queryParsed.error.flatten()
    )
  }

  const { inicio, fim, tecnico, equipe } = queryParsed.data

  const start = new Date(inicio)
  const end = new Date(fim)

  const andWhere: object[] = [
    { deletedAt: null },
    { inicioPrevisto: { lte: end } },
    { fimPrevisto: { gte: start } },
  ]

  if (tecnico) {
    const tecnicos = Array.isArray(tecnico) ? tecnico : [tecnico]
    andWhere.push({ technician: { name: { in: tecnicos } } })
  }

  if (equipe) {
    andWhere.push({ equipe })
  }

  const demands = await prisma.demand.findMany({
    where: { AND: andWhere },
    include: { technician: true },
    orderBy: { inicioPrevisto: "asc" },
  })

  const dateRange = enumerateDateKeysUtc(start, end)

  // Map: technicianId → { name, equipe, days: { dateKey → count } }
  type TechEntry = {
    name: string
    equipe: string
    days: Record<string, number>
  }

  const techMap = new Map<string, TechEntry>()

  for (const d of demands) {
    const key = d.technicianId
    if (!techMap.has(key)) {
      techMap.set(key, {
        name: d.technician.name,
        equipe: d.equipe,
        days: Object.fromEntries(dateRange.map((dk) => [dk, 0])),
      })
    }

    const entry = techMap.get(key)!
    const demandKeys = enumerateDateKeysUtc(d.inicioPrevisto, d.fimPrevisto)

    for (const dk of demandKeys) {
      if (dk in entry.days) {
        entry.days[dk] += 1
      }
    }
  }

  const technicians = [...techMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  return jsonOk({ technicians, dateRange })
}
