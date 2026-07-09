"use client"

import { ReportEmptyState } from "@/components/molecules/report-empty-state"
import { ReportTablePagination } from "@/components/molecules/report-table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatAuditRole } from "@/lib/audit-labels"
import { type PaginatedSlice, type ReportAuditRow } from "@/lib/reports"

const auditDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

type ReportAuditSectionProps = {
  loaded: boolean
  total: number
  paginated: PaginatedSlice<ReportAuditRow>
  onPageChange: (page: number) => void
}

function AuditChangeDetail({ row }: { row: ReportAuditRow }) {
  const hasChange = row.valorAnterior || row.novoValor
  if (!hasChange) return null

  return (
    <p className="mt-1 text-xs text-slate-600">
      <span className="text-slate-400">De </span>
      <span className="font-medium">{row.valorAnterior || "—"}</span>
      <span className="text-slate-400"> para </span>
      <span className="font-medium">{row.novoValor || "—"}</span>
    </p>
  )
}

function AuditDemandRef({ row }: { row: ReportAuditRow }) {
  return (
    <p className="mt-2 text-xs text-slate-500">
      <span className="text-slate-400">Demanda: </span>
      <span className="font-medium text-slate-700">{row.tecnico}</span>
      <span className="text-slate-400"> · </span>
      <span className="font-mono text-[10px] text-slate-400">{row.demandId.slice(0, 8)}…</span>
    </p>
  )
}

function AuditTable({
  rows,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  rows: ReportAuditRow[]
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="space-y-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Quem alterou</TableHead>
            <TableHead>O que mudou</TableHead>
            <TableHead className="hidden md:table-cell">Demanda</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-normal align-top text-xs tabular-nums sm:text-sm">
                {auditDateFormatter.format(new Date(row.createdAt))}
              </TableCell>
              <TableCell className="max-w-36 whitespace-normal align-top sm:max-w-44">
                <span className="block font-medium text-slate-800">{row.ator}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {formatAuditRole(row.atorRole)}
                </span>
              </TableCell>
              <TableCell className="align-top whitespace-normal break-words">
                <span className="font-medium">{row.acao}</span>
                <AuditChangeDetail row={row} />
                {row.justificativa ? (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {row.justificativa}
                  </p>
                ) : null}
                <div className="md:hidden">
                  <AuditDemandRef row={row} />
                </div>
              </TableCell>
              <TableCell className="hidden align-top md:table-cell">
                <span className="block text-sm font-medium text-slate-800">{row.tecnico}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">técnico da demanda</span>
                <span className="mt-1 block font-mono text-[10px] text-slate-400">
                  {row.demandId.slice(0, 8)}…
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReportTablePagination
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  )
}

export function ReportAuditSection({
  loaded,
  total,
  paginated,
  onPageChange,
}: ReportAuditSectionProps) {
  if (!loaded) {
    return (
      <p className="mb-3 text-sm text-slate-500">
        Aplique os filtros para visualizar a auditoria.
      </p>
    )
  }

  if (total === 0) {
    return (
      <ReportEmptyState message="Nenhum registro de auditoria no período selecionado." />
    )
  }

  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        {total} alteração(ões) registrada(s)
      </p>
      <AuditTable
        rows={paginated.items}
        page={paginated.page}
        totalPages={paginated.totalPages}
        rangeStart={paginated.rangeStart}
        rangeEnd={paginated.rangeEnd}
        total={paginated.total}
        onPageChange={onPageChange}
      />
    </>
  )
}
