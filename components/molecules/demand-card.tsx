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
        "border-b border-slate-200 px-4 py-4 transition hover:bg-slate-50/70 last:border-b-0 sm:px-6 sm:py-5"
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              <UserRound className="size-3.5" />
              {demand.tecnico}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
              Equipe {demand.equipe}
            </span>
            <StatusBadge status={demand.status} />
          </div>

          <div>
            <h3 className="text-lg font-semibold leading-tight text-slate-950">
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
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Observacao: </span>
              {demand.observacoes}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "grid gap-2.5 self-start rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700"
          )}
        >
          <div className="mb-0.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Agendamento
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-slate-500" />
            <span className="font-semibold capitalize text-slate-800">
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
          <div className="grid gap-2 pt-1">
            <Button
              className={cn(
                "w-full border-transparent text-white shadow-sm hover:brightness-95",
                demand.status === "Concluído" ? "bg-emerald-700" : "bg-slate-900"
              )}
              size="sm"
              type="button"
              onClick={() => onEditSchedule(demand)}
            >
              Editar horário
            </Button>
            <select
              aria-label={`Alterar status de ${demand.descricao}`}
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2",
                style.calendar,
                "focus:border-blue-500 focus:ring-blue-100"
              )}
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
