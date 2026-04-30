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
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200 sm:grid-cols-[5rem_1fr_auto]"
      type="button"
      onClick={() => onSelect(demand)}
    >
      <div className="text-2xl font-semibold text-slate-950">
        {timeFormatter.format(scheduledAt)}
      </div>

      <div className="min-w-0 space-y-2">
        <div>
          <p className="font-semibold text-slate-950">{demand.descricao}</p>
          <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
            {demand.local}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <UserRound className="size-3.5" />
            {demand.tecnico}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <Clock className="size-3.5" />
            {demand.duracaoPrevista}
          </span>
        </div>
      </div>

      <div className="sm:justify-self-end">
        <StatusBadge status={demand.status} />
      </div>
    </button>
  )
}
