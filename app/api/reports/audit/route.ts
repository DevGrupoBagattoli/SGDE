import { z } from "zod"

import { requireManager, roleFromDb } from "@/lib/server/auth"
import { jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update_status: "Alteração de status",
  update_schedule: "Alteração de horário",
  update_descricao: "Alteração de descrição",
  add_participant: "Adição de participante",
  remove_participant: "Remoção de participante",
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  inicioPrevisto: "Início previsto",
  fimPrevisto: "Fim previsto",
  duracaoMinutos: "Duração",
  descricao: "Descrição",
  participant: "Participante",
}

const querySchema = z.object({
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional(),
  acao: z
    .union([
      z.enum(["schedule", "status", "create"]),
      z.array(z.enum(["schedule", "status", "create"])),
    ])
    .optional(),
  ator: z.string().optional(),
  tecnico: z.string().optional(),
  export: z.literal("csv").optional(),
})

const ACTION_MAP: Record<"schedule" | "status" | "create", string[]> = {
  create: ["create"],
  status: ["update_status"],
  schedule: ["update_schedule"],
}

export async function GET(request: Request) {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const url = new URL(request.url)

  const rawAcao = url.searchParams.getAll("acao")
  const queryParsed = querySchema.safeParse({
    inicio: url.searchParams.get("inicio") ?? undefined,
    fim: url.searchParams.get("fim") ?? undefined,
    acao: rawAcao.length === 1 ? rawAcao[0] : rawAcao.length > 1 ? rawAcao : undefined,
    ator: url.searchParams.get("ator") ?? undefined,
    tecnico: url.searchParams.get("tecnico") ?? undefined,
    export: url.searchParams.get("export") ?? undefined,
  })

  if (!queryParsed.success) {
    return jsonValidationError("Parâmetros de consulta inválidos", queryParsed.error.flatten())
  }

  const { inicio, fim, acao, ator, tecnico } = queryParsed.data

  const andWhere: object[] = []

  if (inicio || fim) {
    const start = inicio ? new Date(inicio) : new Date("1970-01-01T00:00:00.000Z")
    const end = fim ? new Date(fim) : new Date("3000-01-01T00:00:00.000Z")
    andWhere.push({ createdAt: { gte: start } }, { createdAt: { lte: end } })
  }

  if (acao) {
    const acoes = Array.isArray(acao) ? acao : [acao]
    const dbActions = acoes.flatMap((a) => ACTION_MAP[a])
    andWhere.push({ action: { in: dbActions } })
  }

  if (ator) {
    andWhere.push({ actor: { name: ator } })
  }

  if (tecnico) {
    andWhere.push({ demand: { technician: { name: tecnico } } })
  }

  const entries = await prisma.demandAudit.findMany({
    where: andWhere.length > 0 ? { AND: andWhere } : undefined,
    include: {
      actor: true,
      demand: { include: { technician: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const rows = entries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    demandId: e.demandId,
    tecnico: e.demand.technician.name,
    ator: e.actor.name,
    atorRole: roleFromDb(e.actor.role),
    acao: ACTION_LABELS[e.action] ?? e.action,
    campo: FIELD_LABELS[e.field] ?? e.field,
    valorAnterior: e.previousValue ?? "",
    novoValor: e.nextValue ?? "",
    justificativa: e.reason ?? "",
  }))

  if (queryParsed.data.export === "csv") {
    const headers = [
      "Data/hora",
      "Demanda (ID)",
      "Técnico",
      "Ator",
      "Perfil do Ator",
      "Ação",
      "Campo Alterado",
      "Valor Anterior",
      "Novo Valor",
      "Justificativa",
    ]

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escape(r.createdAt),
          escape(r.demandId),
          escape(r.tecnico),
          escape(r.ator),
          escape(r.atorRole),
          escape(r.acao),
          escape(r.campo),
          escape(r.valorAnterior),
          escape(r.novoValor),
          escape(r.justificativa),
        ].join(",")
      ),
    ]

    return new Response(csvLines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio-auditoria.csv"',
      },
    })
  }

  return jsonOk({ entries: rows, total: rows.length })
}
