import { DemandStatus } from "@prisma/client"
import { z } from "zod"

import { requireManager } from "@/lib/server/auth"
import { formatDurationMinutes } from "@/lib/server/dates"
import { jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

const querySchema = z.object({
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional(),
  equipe: z.string().optional(),
  export: z.literal("csv").optional(),
})

export async function GET(request: Request) {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const url = new URL(request.url)

  const queryParsed = querySchema.safeParse({
    inicio: url.searchParams.get("inicio") ?? undefined,
    fim: url.searchParams.get("fim") ?? undefined,
    equipe: url.searchParams.get("equipe") ?? undefined,
    export: url.searchParams.get("export") ?? undefined,
  })

  if (!queryParsed.success) {
    return jsonValidationError("Parâmetros de consulta inválidos", queryParsed.error.flatten())
  }

  const { inicio, fim, equipe } = queryParsed.data

  const andWhere: object[] = []

  if (inicio || fim) {
    const start = inicio ? new Date(inicio) : new Date("1970-01-01T00:00:00.000Z")
    const end = fim ? new Date(fim) : new Date("3000-01-01T00:00:00.000Z")
    andWhere.push({ inicioPrevisto: { gte: start } }, { inicioPrevisto: { lte: end } })
  }

  if (equipe) {
    andWhere.push({ equipe })
  }

  const demands = await prisma.demand.findMany({
    where: andWhere.length > 0 ? { AND: andWhere } : undefined,
    include: { technician: true },
    orderBy: { inicioPrevisto: "asc" },
  })

  // Group by technician
  type TechRow = {
    tecnico: string
    equipe: string
    total: number
    pendentes: number
    emAndamento: number
    concluidas: number
    canceladas: number
    minutosPrevistos: number
  }

  const map = new Map<string, TechRow>()

  for (const d of demands) {
    const key = d.technicianId
    if (!map.has(key)) {
      map.set(key, {
        tecnico: d.technician.name,
        equipe: d.equipe,
        total: 0,
        pendentes: 0,
        emAndamento: 0,
        concluidas: 0,
        canceladas: 0,
        minutosPrevistos: 0,
      })
    }

    const row = map.get(key)!
    row.total += 1
    row.minutosPrevistos += d.duracaoMinutos

    if (d.status === DemandStatus.PENDING) row.pendentes += 1
    else if (d.status === DemandStatus.IN_PROGRESS) row.emAndamento += 1
    else if (d.status === DemandStatus.DONE) row.concluidas += 1
    else if (d.status === DemandStatus.CANCELLED) row.canceladas += 1
  }

  const rows = [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((r) => ({
      ...r,
      taxaConclusao: r.total > 0 ? Math.round((r.concluidas / r.total) * 100) : 0,
      horasPrevistas: formatDurationMinutes(r.minutosPrevistos),
    }))

  if (queryParsed.data.export === "csv") {
    const headers = [
      "Técnico",
      "Equipe",
      "Total",
      "Pendentes",
      "Em Andamento",
      "Concluídas",
      "Canceladas",
      "Taxa de Conclusão (%)",
      "Horas Previstas",
    ]

    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escape(r.tecnico),
          escape(r.equipe),
          escape(r.total),
          escape(r.pendentes),
          escape(r.emAndamento),
          escape(r.concluidas),
          escape(r.canceladas),
          escape(r.taxaConclusao),
          escape(r.horasPrevistas),
        ].join(",")
      ),
    ]

    return new Response(csvLines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio-produtividade.csv"',
      },
    })
  }

  return jsonOk({ technicians: rows, total: rows.length })
}
