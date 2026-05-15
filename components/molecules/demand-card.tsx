"use client"

import { CalendarClock, MapPin, Trash2, UserRound, Users } from "lucide-react"

import { StatusBadge } from "@/components/atoms/status-badge"
import { DemandScheduleTrack } from "@/components/molecules/demand-schedule-track"
import { Button } from "@/components/ui/button"
import { dateFormatter } from "@/lib/calendar"
import {
  Demand,
  DemandStatus,
  statusOptions,
} from "@/lib/demands"

type DemandCardProps = {
  demand: Demand
  isManager?: boolean
  onDeleteDemand?: (demand: Demand) => void
  onEditSchedule: (demand: Demand) => void
  onUpdateStatus: (id: string, status: DemandStatus) => Promise<void> | void
}

export function DemandCard({
  demand,
  isManager,
  onDeleteDemand,
  onEditSchedule,
  onUpdateStatus,
}: DemandCardProps) {
  const scheduledAt = new Date(demand.horarioInicio)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
              <UserRound className="size-4 text-slate-400" />
              {demand.tecnico}
            </span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <StatusBadge status={demand.status} />
          </div>

          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-slate-900">
              {demand.descricao}
            </h3>
            <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              {demand.local}
            </p>
            {demand.solicitante ? (
              <p className="mt-1 text-xs text-slate-500">
                Solicitante:{" "}
                <span className="text-slate-700">{demand.solicitante}</span>
              </p>
            ) : null}
          </div>

          {demand.participantes && demand.participantes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Users className="size-3.5 shrink-0 text-slate-400" />
              {demand.participantes.map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          {demand.observacoes ? (
            <p className="border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
              <span className="text-slate-500">Obs. </span>
              {demand.observacoes}
            </p>
          ) : null}
        </div>

        <div className="w-full shrink-0 space-y-3 border-t border-slate-100 bg-blue-50/30 p-4 sm:p-5 lg:w-72 lg:rounded-l-2xl lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarClock className="size-4 shrink-0 text-slate-400" />
            <span className="capitalize">{dateFormatter.format(scheduledAt)}</span>
          </div>
          <DemandScheduleTrack compact demand={demand} />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => onEditSchedule(demand)}
              >
                Editar horário
              </Button>
              <select
                aria-label={`Alterar status de ${demand.descricao}`}
                className="h-8 min-w-0 flex-1 rounded-4xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
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
            {isManager && onDeleteDemand ? (
              <Button
                className="h-8 w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => onDeleteDemand(demand)}
              >
                <Trash2 className="size-3.5" />
                Excluir demanda
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
