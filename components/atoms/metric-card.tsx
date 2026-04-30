import { type LucideIcon } from "lucide-react"

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: number
  iconClassName?: string
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  iconClassName = "size-4 text-slate-500",
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <Icon className={iconClassName} />
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  )
}
