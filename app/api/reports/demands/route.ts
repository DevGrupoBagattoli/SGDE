import { z } from "zod"

import { requireManager } from "@/lib/server/auth"
import { enumerateDateKeysUtc } from "@/lib/server/dates"
import { demandStatusFromDb, demandStatusToDb } from "@/lib/server/demands"
import { jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

const querySchema = z.object({
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional(),
  status: z
    .union([
      z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]),
      z.array(z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"])),
    ])
    .optional(),
  tecnico: z.string().optional(),
  equipe: z.string().optional(),
  export: z.literal("csv").optional(),
})

export async function GET(request: Request) {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const url = new URL(request.url)

  const rawStatus = url.searchParams.getAll("status")
  const queryParsed = querySchema.safeParse({
    inicio: url.searchParams.get("inicio") ?? undefined,
    fim: url.searchParams.get("fim") ?? undefined,
    status: rawStatus.length === 1 ? rawStatus[0] : rawStatus.length > 1 ? rawStatus : undefined,
    tecnico: url.searchParams.get("tecnico") ?? undefined,
    equipe: url.searchParams.get("equipe") ?? undefined,
    export: url.searchParams.get("export") ?? undefined,
  })

  if (!queryParsed.success) {
    return jsonValidationError("Parâmetros de consulta inválidos", queryParsed.error.flatten())
  }

  const { inicio, fim, status, tecnico, equipe } = queryParsed.data

  const andWhere: object[] = []

  if (inicio || fim) {
    const start = inicio ? new Date(inicio) : new Date("1970-01-01T00:00:00.000Z")
    const end = fim ? new Date(fim) : new Date("3000-01-01T00:00:00.000Z")
    andWhere.push({ inicioPrevisto: { gte: start } }, { inicioPrevisto: { lte: end } })
  }

  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    andWhere.push({ status: { in: statuses.map((s) => demandStatusToDb(s)) } })
  }

  if (tecnico) {
    andWhere.push({ technician: { name: tecnico } })
  }

  if (equipe) {
    andWhere.push({ equipe })
  }

  const demands = await prisma.demand.findMany({
    where: andWhere.length > 0 ? { AND: andWhere } : undefined,
    include: {
      technician: true,
      createdBy: true,
      participants: { include: { user: true } },
    },
    orderBy: { inicioPrevisto: "asc" },
  })

  const rows = demands.map((d) => ({
    id: d.id,
    tecnico: d.technician.name,
    equipe: d.equipe,
    local: d.local,
    descricao: d.descricao,
    status: demandStatusFromDb(d.status),
    horarioInicio: d.inicioPrevisto.toISOString(),
    horarioFim: d.fimPrevisto.toISOString(),
    duracaoPrevista: `${String(Math.floor(d.duracaoMinutos / 60)).padStart(2, "0")}:${String(d.duracaoMinutos % 60).padStart(2, "0")}h`,
    solicitante: d.createdBy.name,
    participantes: d.participants.map((p) => p.user.name).join(", "),
    dateKeys: enumerateDateKeysUtc(d.inicioPrevisto, d.fimPrevisto),
  }))

  if (queryParsed.data.export === "csv") {
    const headers = [
      "Protocolo",
      "Técnico",
      "Equipe",
      "Local",
      "Descrição",
      "Status",
      "Início Previsto",
      "Fim Previsto",
      "Duração Prevista",
      "Solicitante",
      "Participantes",
    ]

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escape(r.id),
          escape(r.tecnico),
          escape(r.equipe),
          escape(r.local),
          escape(r.descricao),
          escape(r.status),
          escape(r.horarioInicio),
          escape(r.horarioFim),
          escape(r.duracaoPrevista),
          escape(r.solicitante),
          escape(r.participantes),
        ].join(",")
      ),
    ]

    return new Response(csvLines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio-demandas.csv"',
      },
    })
  }

  return jsonOk({ demands: rows, total: rows.length })
}
