"use client"

import { MapPin, UserRound } from "lucide-react"

import { StatusBadge } from "@/components/atoms/status-badge"
import { DemandScheduleTrack } from "@/components/molecules/demand-schedule-track"
import { Demand } from "@/lib/demands"

type DemandTimeSlotProps = {
  demand: Demand
  onSelect: (demand: Demand) => void
}

export function DemandTimeSlot({ demand, onSelect }: DemandTimeSlotProps) {
  return (
    <button
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
      type="button"
      onClick={() => onSelect(demand)}
    >
      <DemandScheduleTrack demand={demand} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="font-semibold text-slate-950">{demand.descricao}</p>
            <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
              {demand.local}
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <UserRound className="size-3.5" />
            {demand.tecnico}
          </span>
        </div>

        <div className="sm:shrink-0 sm:pt-0.5">
          <StatusBadge status={demand.status} />
        </div>
      </div>
    </button>
  )
}
