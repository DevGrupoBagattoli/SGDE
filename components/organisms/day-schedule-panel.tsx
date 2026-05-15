"use client"

import { CalendarClock } from "lucide-react"

import { DemandTimeSlot } from "@/components/molecules/demand-time-slot"
import { longDateFormatter } from "@/lib/calendar"
import { Demand } from "@/lib/demands"

type DaySchedulePanelProps = {
  demands: Demand[]
  selectedDate: Date
  isManager?: boolean
  onDeleteDemand?: (demand: Demand) => void
  onSelectDemand: (demand: Demand) => void
}

export function DaySchedulePanel({
  demands,
  selectedDate,
  isManager,
  onDeleteDemand,
  onSelectDemand,
}: DaySchedulePanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Horários ocupados</h2>
          <p className="text-sm capitalize text-slate-500">
            {longDateFormatter.format(selectedDate)}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          <CalendarClock className="size-4" />
          {demands.length} demanda{demands.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {demands.length > 0 ? (
          demands.map((demand) => (
            <DemandTimeSlot
              demand={demand}
              isManager={isManager}
              key={demand.id}
              onDeleteDemand={onDeleteDemand}
              onSelect={onSelectDemand}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Nenhuma demanda marcada para este dia.
          </div>
        )}
      </div>
    </section>
  )
}
