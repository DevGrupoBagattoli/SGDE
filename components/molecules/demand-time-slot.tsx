"use client"

import { Clock, MapPin, UserRound } from "lucide-react"

import { StatusBadge } from "@/components/atoms/status-badge"
import { timeFormatter } from "@/lib/calendar"
import { Demand } from "@/lib/demands"

type DemandTimeSlotProps = {
  demand: Demand
  onSelect: (demand: Demand) => void
}

export function DemandTimeSlot({ demand, onSelect }: DemandTimeSlotProps) {
  const scheduledAt = new Date(demand.horarioInicio)

  return (
    <button
      className="grid w-full gap-3 border-b border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 last:border-b-0 sm:grid-cols-[5.5rem_1fr_auto] sm:px-5 sm:py-5"
      type="button"
      onClick={() => onSelect(demand)}
    >
      <div className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
        {timeFormatter.format(scheduledAt)}
      </div>

      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-xl font-semibold leading-tight text-slate-950 sm:text-lg">
            {demand.descricao}
          </p>
          <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
            {demand.local}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <UserRound className="size-3.5" />
            {demand.tecnico}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Clock className="size-3.5" />
            {demand.duracaoPrevista}
          </span>
        </div>
      </div>

      <div className="sm:justify-self-end sm:self-start">
        <StatusBadge status={demand.status} />
      </div>
    </button>
  )
}
