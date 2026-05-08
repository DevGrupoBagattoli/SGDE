import { DemandStatus, statusStyles } from "@/lib/demands"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: DemandStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        style.badge
      )}
    >
      <span className={cn("size-2 rounded-full", style.dot)} />
      {status}
    </span>
  )
}
