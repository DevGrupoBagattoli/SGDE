"use client"

import { ArrowRight } from "lucide-react"

import { timeFormatter } from "@/lib/calendar"
import { Demand, predictedEndDate } from "@/lib/demands"
import { cn } from "@/lib/utils"

type DemandScheduleTrackProps = {
  demand: Demand
  compact?: boolean
}

export function DemandScheduleTrack({
  demand,
  compact = false,
}: DemandScheduleTrackProps) {
  const start = new Date(demand.horarioInicio)
  const end = predictedEndDate(demand)

  return (
    <div
      className={cn("w-full", compact ? "max-w-sm" : "")}
      aria-label={`De ${timeFormatter.format(start)} até ${timeFormatter.format(end)}, duração ${demand.duracaoPrevista}`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn("shrink-0 text-left", compact ? "" : "min-w-[4.25rem]")}>
          <p
            className={cn(
              "font-bold tabular-nums tracking-tight text-slate-900",
              compact ? "text-sm" : "text-lg sm:text-xl"
            )}
          >
            {timeFormatter.format(start)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Início
          </p>
        </div>

        <div className="relative flex min-h-9 min-w-0 flex-1 items-center">
          <div
            className="absolute left-0 right-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-200 via-sky-400 to-blue-600 sm:right-5"
            aria-hidden
          />
          <div
            className={cn(
              "relative z-[1] ml-auto flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white",
              compact ? "size-6" : "size-7 sm:size-8"
            )}
            aria-hidden
          >
            <ArrowRight
              className={cn(compact ? "size-3" : "size-3.5 sm:size-4")}
              strokeWidth={2.5}
            />
          </div>
        </div>

        <div className={cn("shrink-0 text-right", compact ? "" : "min-w-[4.25rem]")}>
          <p
            className={cn(
              "font-bold tabular-nums tracking-tight text-blue-700",
              compact ? "text-sm" : "text-lg sm:text-xl"
            )}
          >
            {timeFormatter.format(end)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Término previsto
          </p>
        </div>
      </div>

      <p
        className={cn(
          "mt-2 text-center text-xs font-medium text-slate-500 sm:text-left",
          compact ? "mt-1.5" : ""
        )}
      >
        Duração prevista: {demand.duracaoPrevista}
      </p>
    </div>
  )
}
