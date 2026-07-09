"use client"

import { useMemo } from "react"

import { StatusBadge } from "@/components/atoms/status-badge"
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
import { dateFormatter, timeFormatter } from "@/lib/calendar"
import { statusLabels, statusStyles } from "@/lib/demands"
import {
  countDemandsByStatus,
  type PaginatedSlice,
  type ReportDemandRow,
} from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportDemandsSectionProps = {
  loaded: boolean
  total: number
  demands: ReportDemandRow[]
  paginated: PaginatedSlice<ReportDemandRow>
  onPageChange: (page: number) => void
}

function DemandsStatusSummary({ rows }: { rows: ReportDemandRow[] }) {
  const counts = useMemo(() => countDemandsByStatus(rows), [rows])

  return (
    <div className="flex flex-wrap gap-2">
      {statusLabels.map((status) => {
        const count = counts[status]
        if (count === 0) return null
        const style = statusStyles[status]
        return (
          <span
            key={status}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1",
              style.badge
            )}
          >
            <span className={cn("size-2 rounded-full", style.dot)} />
            {status}: {count}
          </span>
        )
      })}
    </div>
  )
}

function DemandsTable({
  rows,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  rows: ReportDemandRow[]
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
            <TableHead>Técnico</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Equipe</TableHead>
            <TableHead className="hidden lg:table-cell">Início</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const start = new Date(row.horarioInicio)
            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-32 truncate font-medium">{row.tecnico}</TableCell>
                <TableCell className="max-w-56 truncate">{row.descricao}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">{row.equipe}</TableCell>
                <TableCell className="hidden whitespace-normal lg:table-cell">
                  <span className="block text-xs text-slate-500">
                    {dateFormatter.format(start)}
                  </span>
                  <span className="text-sm tabular-nums">{timeFormatter.format(start)}</span>
                </TableCell>
              </TableRow>
            )
          })}
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

export function ReportDemandsSection({
  loaded,
  total,
  demands,
  paginated,
  onPageChange,
}: ReportDemandsSectionProps) {
  if (!loaded) {
    return (
      <p className="mb-3 text-sm text-slate-500">
        Aplique os filtros para visualizar as demandas.
      </p>
    )
  }

  if (total === 0) {
    return (
      <ReportEmptyState message="Nenhuma demanda encontrada no período selecionado." />
    )
  }

  return (
    <>
      <div className="mb-3 space-y-2">
        <p className="text-sm text-slate-500">{total} demanda(s) no período</p>
        <DemandsStatusSummary rows={demands} />
      </div>
      <DemandsTable
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
