"use client"

import { useMemo } from "react"

import { ReportEmptyState } from "@/components/molecules/report-empty-state"
import { formatReportDayLabel, occupationHeatLevel, type ReportOccupationTechnician } from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportOccupationSectionProps = {
  loaded: boolean
  technicians: ReportOccupationTechnician[]
  dateRange: string[]
}

function OccupationLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="font-medium text-slate-700">Legenda:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-50 text-slate-400">
          ·
        </span>
        Livre
      </span>
      {[1, 2, 3].map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-[10px] tabular-nums",
              occupationHeatLevel(n)
            )}
          >
            {n}
          </span>
          {n === 3 ? "3+ demandas/dia" : `${n} demanda${n > 1 ? "s" : ""}`}
        </span>
      ))}
    </div>
  )
}

function OccupationGrid({
  technicians,
  dateRange,
}: {
  technicians: ReportOccupationTechnician[]
  dateRange: string[]
}) {
  const busiestDay = useMemo(() => {
    if (dateRange.length === 0 || technicians.length === 0) return null
    const totals = new Map<string, number>()
    for (const key of dateRange) {
      totals.set(
        key,
        technicians.reduce((sum, tech) => sum + (tech.days[key] ?? 0), 0)
      )
    }
    let maxKey = dateRange[0]
    let maxVal = 0
    for (const [key, val] of totals) {
      if (val > maxVal) {
        maxVal = val
        maxKey = key
      }
    }
    return maxVal > 0 ? { key: maxKey, total: maxVal } : null
  }, [dateRange, technicians])

  if (dateRange.length === 0) {
    return <ReportEmptyState message="Informe um período válido." />
  }

  if (technicians.length === 0) {
    return <ReportEmptyState message="Nenhuma ocupação no período com os filtros aplicados." />
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Veja onde a equipe está concentrada dia a dia. Células vazias indicam
        disponibilidade; tons mais escuros indicam mais demandas no mesmo dia.
      </p>

      {busiestDay ? (
        <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Dia mais carregado:{" "}
          <strong>{formatReportDayLabel(busiestDay.key)}</strong> com{" "}
          {busiestDay.total} demanda{busiestDay.total === 1 ? "" : "s"} na equipe.
        </p>
      ) : null}

      <OccupationLegend />

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                Técnico
              </th>
              {dateRange.map((key) => (
                <th
                  key={key}
                  className="min-w-9 px-1 py-2 text-center font-medium text-slate-600"
                  title={key}
                >
                  {formatReportDayLabel(key)}
                </th>
              ))}
              <th className="bg-slate-50 px-3 py-2 text-center font-semibold text-slate-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((tech) => {
              const rowTotal = dateRange.reduce(
                (sum, key) => sum + (tech.days[key] ?? 0),
                0
              )

              return (
                <tr key={tech.name} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800">
                    <span className="block">{tech.name}</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      {tech.equipe}
                    </span>
                  </td>
                  {dateRange.map((key) => {
                    const count = tech.days[key] ?? 0
                    return (
                      <td key={key} className="p-1 text-center">
                        <span
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-lg text-[11px] tabular-nums",
                            occupationHeatLevel(count)
                          )}
                          title={`${count} demanda(s) em ${formatReportDayLabel(key)}`}
                        >
                          {count || "·"}
                        </span>
                      </td>
                    )
                  })}
                  <td className="bg-slate-50/50 px-2 py-2 text-center font-semibold tabular-nums text-slate-800">
                    {rowTotal}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ReportOccupationSection({
  loaded,
  technicians,
  dateRange,
}: ReportOccupationSectionProps) {
  if (!loaded) {
    return (
      <p className="mb-3 text-sm text-slate-500">
        Aplique os filtros para visualizar a ocupação.
      </p>
    )
  }

  if (technicians.length === 0) {
    return (
      <ReportEmptyState message="Nenhuma ocupação encontrada no período selecionado." />
    )
  }

  return <OccupationGrid technicians={technicians} dateRange={dateRange} />
}
