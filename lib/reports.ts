import { DemandStatus, statusLabels } from "@/lib/demands"

export type ReportTab = "demands" | "productivity" | "audit" | "occupation"

export type ReportDateRange = {
  inicio: string
  fim: string
}

export type ReportDemandsFilters = ReportDateRange & {
  status: DemandStatus[]
  tecnico: string
}

export type ReportProductivityFilters = ReportDateRange

export type ReportAuditAction = "schedule" | "status" | "create" | "description" | "delete"

export type ReportAuditFilters = ReportDateRange & {
  acao: ReportAuditAction[]
  ator: string
  tecnico: string
}

export type ReportOccupationFilters = ReportDateRange & {
  tecnico: string[]
}

export type ReportDemandRow = {
  id: string
  tecnico: string
  equipe: string
  local: string
  descricao: string
  status: DemandStatus
  horarioInicio: string
  horarioFim: string
  duracaoPrevista: string
  solicitante: string
  participantes: string
  dateKeys: string[]
}

export type ReportProductivityRow = {
  tecnico: string
  equipe: string
  total: number
  pendentes: number
  emAndamento: number
  concluidas: number
  canceladas: number
  taxaConclusao: number
  horasPrevistas: string
}

export type ReportAuditRow = {
  id: string
  createdAt: string
  demandId: string
  tecnico: string
  ator: string
  atorRole: string
  acao: string
  campo: string
  valorAnterior: string
  novoValor: string
  justificativa: string
}

export type ReportOccupationTechnician = {
  name: string
  equipe: string
  days: Record<string, number>
}

export const reportStatusOptions = statusLabels

export const auditActionOptions: Array<{ value: ReportAuditAction; label: string }> = [
  { value: "create", label: "Criação" },
  { value: "status", label: "Status" },
  { value: "schedule", label: "Agenda" },
  { value: "description", label: "Descrição" },
  { value: "delete", label: "Exclusão" },
]

export const toIsoStartOfDay = (dateInput: string) => {
  const [y, m, d] = dateInput.split("-").map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

export const toIsoEndOfDay = (dateInput: string) => {
  const [y, m, d] = dateInput.split("-").map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}

export const defaultReportDateInputs = (): ReportDateRange => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return { inicio: fmt(start), fim: fmt(end) }
}

export const appendDateRangeParams = (
  params: URLSearchParams,
  range: ReportDateRange
) => {
  if (range.inicio) params.set("inicio", toIsoStartOfDay(range.inicio))
  if (range.fim) params.set("fim", toIsoEndOfDay(range.fim))
}

/** Returns a user-facing error message, or null when the range is valid. */
export const validateReportDateRange = (range: ReportDateRange): string | null => {
  if (!range.inicio || !range.fim) {
    return "Informe a data inicial e a data final."
  }
  if (range.inicio > range.fim) {
    return "A data inicial deve ser anterior ou igual à data final."
  }
  return null
}

export const formatReportDayLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

export const occupationHeatLevel = (count: number) => {
  if (count === 0) return "bg-slate-50 text-slate-400"
  if (count === 1) return "bg-blue-50 text-blue-800"
  if (count === 2) return "bg-blue-100 text-blue-900"
  if (count === 3) return "bg-blue-200 text-blue-950"
  return "bg-blue-300 text-blue-950 font-semibold"
}

/** Conclusão sobre demandas ainda relevantes (exclui canceladas). */
export const productivityCompletionRate = (row: ReportProductivityRow) => {
  const actionable = row.total - row.canceladas
  if (actionable <= 0) return 0
  return Math.round((row.concluidas / actionable) * 100)
}

export const summarizeProductivity = (rows: ReportProductivityRow[]) => {
  const totals = rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      concluidas: acc.concluidas + row.concluidas,
      emAberto: acc.emAberto + row.pendentes + row.emAndamento,
      canceladas: acc.canceladas + row.canceladas,
    }),
    { total: 0, concluidas: 0, emAberto: 0, canceladas: 0 }
  )

  const actionable = totals.total - totals.canceladas
  const taxaConclusao =
    actionable > 0 ? Math.round((totals.concluidas / actionable) * 100) : 0

  return {
    tecnicos: rows.length,
    ...totals,
    taxaConclusao,
  }
}

export const REPORT_PAGE_SIZE = 20

export type PaginatedSlice<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
}

export const buildPaginationRange = (
  page: number,
  totalPages: number
): Array<number | "ellipsis"> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pageSet = new Set<number>([
    1,
    totalPages,
    page,
    page - 1,
    page + 1,
  ])

  const sorted = [...pageSet]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)

  const result: Array<number | "ellipsis"> = []

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]
    const previous = sorted[index - 1]
    if (index > 0 && current - previous > 1) {
      result.push("ellipsis")
    }
    result.push(current)
  }

  return result
}

export const paginateList = <T>(
  items: T[],
  page: number,
  pageSize = REPORT_PAGE_SIZE
): PaginatedSlice<T> => {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, total)

  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: end,
  }
}

export const countDemandsByStatus = (rows: ReportDemandRow[]) => {
  const counts: Record<DemandStatus, number> = {
    Pendente: 0,
    "Em Andamento": 0,
    "Concluído": 0,
    Cancelado: 0,
  }
  for (const row of rows) {
    counts[row.status] += 1
  }
  return counts
}
