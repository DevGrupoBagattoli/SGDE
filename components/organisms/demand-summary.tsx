import { MetricCard } from "@/components/atoms/metric-card"
import {
  DemandStatus,
  type SummaryDetailSegment,
  statusLabels,
  statusStyles,
  totalMetricIcon,
} from "@/lib/demands"

type DemandSummaryProps = {
  statusTotals: Array<{
    status: DemandStatus
    total: number
  }>
  totalDemands: number
  /** Abre o modal de detalhes ao tocar em cada card. */
  onSelectSegment?: (segment: SummaryDetailSegment) => void
}

export function DemandSummary({
  statusTotals,
  totalDemands,
  onSelectSegment,
}: DemandSummaryProps) {
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <MetricCard
        icon={totalMetricIcon}
        label="Total"
        value={totalDemands}
        onPress={
          onSelectSegment ? () => onSelectSegment("total") : undefined
        }
      />
      {statusLabels.map((status) => {
        const total =
          statusTotals.find((statusTotal) => statusTotal.status === status)
            ?.total ?? 0
        const Icon = statusStyles[status].icon
        const iconClassName =
          status === "Concluído"
            ? "size-4 text-emerald-500"
            : status === "Cancelado"
              ? "size-4 text-slate-400"
              : "size-4 text-blue-500"

        return (
          <MetricCard
            icon={Icon}
            iconClassName={iconClassName}
            key={status}
            label={status}
            value={total}
            onPress={
              onSelectSegment ? () => onSelectSegment(status) : undefined
            }
          />
        )
      })}
    </section>
  )
}
