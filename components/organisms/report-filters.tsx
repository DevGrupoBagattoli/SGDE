"use client"

import { Download, Loader2, RefreshCw } from "lucide-react"

import { ReportFilterField } from "@/components/molecules/report-filter-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DemandStatus } from "@/lib/demands"
import {
  auditActionOptions,
  reportStatusOptions,
  type ReportAuditAction,
  type ReportTab,
} from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportFiltersProps = {
  tab: ReportTab
  technicians: string[]
  inicio: string
  fim: string
  tecnico: string
  statusFilter: DemandStatus[]
  auditActions: ReportAuditAction[]
  ator: string
  occupationTechnicians: string[]
  loading: boolean
  exporting: boolean
  showExport: boolean
  canExport: boolean
  onInicioChange: (value: string) => void
  onFimChange: (value: string) => void
  onTecnicoChange: (value: string) => void
  onAtorChange: (value: string) => void
  onToggleStatus: (status: DemandStatus) => void
  onToggleAuditAction: (action: ReportAuditAction) => void
  onToggleOccupationTechnician: (name: string) => void
  onApply: () => void
  onExport: () => void
}

export function ReportFilters({
  tab,
  technicians,
  inicio,
  fim,
  tecnico,
  statusFilter,
  auditActions,
  ator,
  occupationTechnicians,
  loading,
  exporting,
  showExport,
  canExport,
  onInicioChange,
  onFimChange,
  onTecnicoChange,
  onAtorChange,
  onToggleStatus,
  onToggleAuditAction,
  onToggleOccupationTechnician,
  onApply,
  onExport,
}: ReportFiltersProps) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReportFilterField label="Início">
          <Input type="date" value={inicio} onChange={(event) => onInicioChange(event.target.value)} />
        </ReportFilterField>
        <ReportFilterField label="Fim">
          <Input type="date" value={fim} onChange={(event) => onFimChange(event.target.value)} />
        </ReportFilterField>
        {tab === "demands" || tab === "audit" ? (
          <ReportFilterField label="Técnico">
            <select
              className="h-9 w-full rounded-4xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
              value={tecnico}
              onChange={(event) => onTecnicoChange(event.target.value)}
            >
              <option value="">Todos</option>
              {technicians.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </ReportFilterField>
        ) : null}
      </div>

      {tab === "demands" ? (
        <div className="flex flex-wrap gap-2">
          {reportStatusOptions.map((status) => (
            <button
              key={status}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter.includes(status)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => onToggleStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            {auditActionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  auditActions.includes(option.value)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
                onClick={() => onToggleAuditAction(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ReportFilterField label="Ator">
            <Input
              placeholder="Nome do gestor ou eletricista"
              value={ator}
              onChange={(event) => onAtorChange(event.target.value)}
            />
          </ReportFilterField>
        </div>
      ) : null}

      {tab === "occupation" && technicians.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {technicians.map((name) => (
            <button
              key={name}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                occupationTechnicians.includes(name)
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => onToggleOccupationTechnician(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={loading} onClick={onApply}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Aplicar filtros
        </Button>
        {showExport ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canExport || exporting || loading}
            onClick={onExport}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exportar CSV
          </Button>
        ) : null}
      </div>
    </>
  )
}
