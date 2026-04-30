"use client"

import { Demand, statusStyles } from "@/lib/demands"
import { timeFormatter } from "@/lib/calendar"
import { cn } from "@/lib/utils"

type CalendarEventPillProps = {
  demand: Demand
  onSelect: (demand: Demand) => void
}

export function CalendarEventPill({
  demand,
  onSelect,
}: CalendarEventPillProps) {
  return (
    <button
      className={cn(
        "rounded-xl border p-2 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200",
        statusStyles[demand.status].calendar
      )}
      type="button"
      onClick={() => onSelect(demand)}
    >
      <span className="block font-semibold">
        {timeFormatter.format(new Date(demand.horarioInicio))} ·{" "}
        {demand.tecnico}
      </span>
      <span className="mt-1 line-clamp-2 block">{demand.local}</span>
    </button>
  )
}
