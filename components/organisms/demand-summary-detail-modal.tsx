"use client"

import { MapPin, UserRound } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { dateFormatter, timeFormatter } from "@/lib/calendar"
import { Demand, statusStyles, type SummaryDetailSegment } from "@/lib/demands"
import { cn } from "@/lib/utils"

type DemandSummaryDetailModalProps = {
  segment: SummaryDetailSegment | null
  demands: Demand[]
  onOpenChange: (open: boolean) => void
  onEditSchedule: (demand: Demand) => void
}

function segmentTitle(segment: SummaryDetailSegment): string {
  switch (segment) {
    case "total":
      return "Todas as demandas"
    case "Pendente":
      return "Pendentes"
    case "Em Andamento":
      return "Em andamento"
    case "Concluído":
      return "Concluídas"
    case "Cancelado":
      return "Canceladas"
  }
}

function SimpleDemandRow({
  demand,
  onEdit,
}: {
  demand: Demand
  onEdit: () => void
}) {
  const start = new Date(demand.horarioInicio)
  const time = timeFormatter.format(start)
  const dateLine = dateFormatter.format(start)

  const statusClass = statusStyles[demand.status].panel.replace("/70", "")

  return (
    <li className="border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex gap-3 sm:gap-4">
        <div className="w-12 shrink-0 pt-0.5 text-right sm:w-14">
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {time}
          </p>
          <p className="text-[11px] leading-tight text-slate-400">{dateLine}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[15px] font-medium leading-snug text-slate-900">
            {demand.descricao}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5 shrink-0 opacity-70" />
              {demand.tecnico}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex min-w-0 items-start gap-1">
              <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" />
              <span className="wrap-break-word">{demand.local}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                statusClass,
              )}
            >
              {demand.status}
            </span>
            <span className="text-[11px] text-slate-400">
              {demand.duracaoPrevista}
            </span>
          </div>

          {demand.observacoes ? (
            <p className="text-xs leading-relaxed text-slate-500 line-clamp-2">
              {demand.observacoes}
            </p>
          ) : null}

          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={onEdit}
          >
            Editar agenda
          </button>
        </div>
      </div>
    </li>
  )
}

export function DemandSummaryDetailModal({
  segment,
  demands,
  onOpenChange,
  onEditSchedule,
}: DemandSummaryDetailModalProps) {
  const open = segment !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(88vh,640px)] max-w-[calc(100%-1.25rem)] gap-0 overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-lg sm:max-w-md"
        showCloseButton
      >
        {segment ? (
          <>
            <DialogHeader className="space-y-1 px-5 pt-5 pr-12 pb-3 sm:px-6 sm:pr-14">
              <DialogTitle className="text-base font-semibold tracking-tight text-slate-900">
                {segmentTitle(segment)}
                <span className="ml-1.5 font-normal text-slate-400">
                  · {demands.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {demands.length === 0
                  ? "Nada nesta categoria com o filtro atual."
                  : "Resumo por horário. Use a lista completa para alterar status."}
              </DialogDescription>
            </DialogHeader>

            <div className="border-t border-slate-100 bg-slate-50/80">
              <div className="max-h-[min(62vh,480px)] overflow-y-auto px-3 py-2 sm:px-4">
                {demands.length === 0 ? (
                  <p className="px-2 py-10 text-center text-sm text-slate-500">
                    Sem itens para mostrar.
                  </p>
                ) : (
                  <ul className="rounded-xl bg-white px-2 py-1 sm:px-3">
                    {demands.map((demand) => (
                      <SimpleDemandRow
                        key={demand.id}
                        demand={demand}
                        onEdit={() => {
                          onEditSchedule(demand)
                          onOpenChange(false)
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
