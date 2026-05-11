import { type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: number
  iconClassName?: string
  /** When set, the card is a button (detalhes / drill-down). */
  onPress?: () => void
  pressAriaLabel?: string
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  iconClassName = "size-4 text-slate-500",
  onPress,
  pressAriaLabel,
}: MetricCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <Icon className={iconClassName} aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {onPress ? (
        <span className="mt-2 block text-xs font-medium text-blue-600">
          Ver detalhes
        </span>
      ) : null}
    </>
  )

  const shellClass = cn(
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
    onPress &&
      "w-full cursor-pointer text-left transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 active:scale-[0.99]",
  )

  if (onPress) {
    return (
      <button
        type="button"
        className={shellClass}
        aria-label={
          pressAriaLabel ?? `Ver detalhes: ${label}, ${value} demandas`
        }
        onClick={onPress}
      >
        {body}
      </button>
    )
  }

  return <div className={shellClass}>{body}</div>
}
