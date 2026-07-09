type ReportSummaryKpiProps = {
  label: string
  value: string | number
  hint?: string
}

export function ReportSummaryKpi({ label, value, hint }: ReportSummaryKpiProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}
