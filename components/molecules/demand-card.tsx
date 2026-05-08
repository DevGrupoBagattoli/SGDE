"use client"

import { CalendarClock, Clock, MapPin, UserRound, Users } from "lucide-react"

import { StatusBadge } from "@/components/atoms/status-badge"
import { Button } from "@/components/ui/button"
import { dateFormatter, timeFormatter } from "@/lib/calendar"
import {
  Demand,
  DemandStatus,
  statusOptions,
  statusStyles,
} from "@/lib/demands"
import { cn } from "@/lib/utils"

type DemandCardProps = {
  demand: Demand
  onEditSchedule: (demand: Demand) => void
  onUpdateStatus: (id: string, status: DemandStatus) => void
}

export function DemandCard({
  demand,
  onEditSchedule,
  onUpdateStatus,
}: DemandCardProps) {
  const scheduledAt = new Date(demand.horarioInicio)
  const style = statusStyles[demand.status]

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        style.border
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <UserRound className="size-3.5" />
              {demand.tecnico}
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              Equipe {demand.equipe}
            </span>
            <StatusBadge status={demand.status} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {demand.descricao}
            </h3>
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
              {demand.local}
            </p>
          </div>

          {demand.participantes && demand.participantes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Users className="size-3.5 shrink-0 text-slate-400" />
              {demand.participantes.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 ring-1 ring-blue-200"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          {demand.observacoes ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Obs.: </span>
              {demand.observacoes}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "grid gap-3 rounded-2xl p-3 text-sm text-slate-700 sm:min-w-64",
            style.panel
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-slate-500" />
            <span className="font-medium capitalize">
              {dateFormatter.format(scheduledAt)}
            </span>
            <span className="text-slate-500">
              às {timeFormatter.format(scheduledAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-slate-500" />
            <span>{demand.duracaoPrevista} previstos</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              size="sm"
              type="button"
              onClick={() => onEditSchedule(demand)}
            >
              Editar horário
            </Button>
            <select
              aria-label={`Alterar status de ${demand.descricao}`}
              className="h-8 flex-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={demand.status}
              onChange={(event) =>
                onUpdateStatus(demand.id, event.target.value as DemandStatus)
              }
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </article>
  )
}
