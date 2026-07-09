"use client"

import { useMemo } from "react"

import { ReportEmptyState } from "@/components/molecules/report-empty-state"
import { ReportSummaryKpi } from "@/components/molecules/report-summary-kpi"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  productivityCompletionRate,
  summarizeProductivity,
  type ReportProductivityRow,
} from "@/lib/reports"
import { cn } from "@/lib/utils"

const STATUS_BAR_PARTS: Array<{
  key: keyof Pick<
    ReportProductivityRow,
    "pendentes" | "emAndamento" | "concluidas" | "canceladas"
  >
  label: string
  color: string
}> = [
  { key: "pendentes", label: "Pendente", color: "bg-amber-400" },
  { key: "emAndamento", label: "Em andamento", color: "bg-blue-500" },
  { key: "concluidas", label: "Concluída", color: "bg-emerald-500" },
  { key: "canceladas", label: "Cancelada", color: "bg-slate-300" },
]

type ReportProductivitySectionProps = {
  loaded: boolean
  rows: ReportProductivityRow[]
}

function StatusMixBar({ row }: { row: ReportProductivityRow }) {
  if (row.total === 0) {
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div className="space-y-1">
      <div
        className="flex h-2 w-full min-w-20 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Distribuição: ${row.pendentes} pendentes, ${row.emAndamento} em andamento, ${row.concluidas} concluídas, ${row.canceladas} canceladas`}
      >
        {STATUS_BAR_PARTS.map((part) => {
          const count = row[part.key]
          if (count === 0) return null
          return (
            <div
              key={part.key}
              className={cn(part.color, "h-full min-w-px")}
              style={{ width: `${(count / row.total) * 100}%` }}
              title={`${part.label}: ${count}`}
            />
          )
        })}
      </div>
      <p className="text-[10px] text-slate-500">
        {row.pendentes}P · {row.emAndamento}EA · {row.concluidas}C
        {row.canceladas > 0 ? ` · ${row.canceladas} canc.` : ""}
      </p>
    </div>
  )
}

function ProductivityTable({ rows }: { rows: ReportProductivityRow[] }) {
  const summary = useMemo(() => summarizeProductivity(rows), [rows])

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Compare carga e andamento por técnico. A taxa de conclusão ignora demandas
        canceladas.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportSummaryKpi label="Técnicos" value={summary.tecnicos} />
        <ReportSummaryKpi label="Demandas no período" value={summary.total} />
        <ReportSummaryKpi
          label="Em aberto"
          value={summary.emAberto}
          hint="Pendentes + em andamento"
        />
        <ReportSummaryKpi
          label="Taxa de conclusão"
          value={`${summary.taxaConclusao}%`}
          hint={`${summary.concluidas} concluídas (sem canceladas)`}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Técnico</TableHead>
            <TableHead>Mix de status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Conclusão</TableHead>
            <TableHead className="hidden text-right md:table-cell">Horas prev.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const taxa = productivityCompletionRate(row)
            const sobrecarga = row.pendentes + row.emAndamento >= 5

            return (
              <TableRow key={row.tecnico}>
                <TableCell>
                  <span className="font-medium">{row.tecnico}</span>
                  <span className="block text-xs text-slate-500">{row.equipe}</span>
                  {sobrecarga ? (
                    <span className="mt-1 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Alta carga em aberto
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="min-w-28">
                  <StatusMixBar row={row} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-medium">{taxa}%</span>
                  <span className="block text-[10px] text-slate-500">
                    {row.concluidas}/{row.total - row.canceladas || "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {row.horasPrevistas}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function ReportProductivitySection({ loaded, rows }: ReportProductivitySectionProps) {
  if (!loaded) {
    return (
      <p className="mb-3 text-sm text-slate-500">
        Aplique os filtros para visualizar os dados.
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <ReportEmptyState message="Sem dados de produtividade no período selecionado." />
    )
  }

  return <ProductivityTable rows={rows} />
}
