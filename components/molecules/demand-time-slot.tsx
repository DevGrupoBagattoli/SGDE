"use client"

import { MapPin, MoreVertical, Pencil, Trash2, UserRound } from "lucide-react"

import { StatusBadge } from "@/components/atoms/status-badge"
import { DemandScheduleTrack } from "@/components/molecules/demand-schedule-track"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Demand } from "@/lib/demands"
import { cn } from "@/lib/utils"

type DemandTimeSlotProps = {
  demand: Demand
  isManager?: boolean
  onDeleteDemand?: (demand: Demand) => void
  onSelect: (demand: Demand) => void
}

function MetaRow({
  icon: Icon,
  value,
  className,
}: {
  icon: typeof MapPin
  value: string
  className?: string
}) {
  return (
    <li className={cn("flex min-w-0 items-start gap-2", className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 flex-1 line-clamp-3 break-words font-medium text-slate-800">
        {value}
      </span>
    </li>
  )
}

export function DemandTimeSlot({
  demand,
  isManager,
  onDeleteDemand,
  onSelect,
}: DemandTimeSlotProps) {
  const canDelete = isManager && onDeleteDemand
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3 z-10 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={`Opções de ${demand.descricao}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onSelect(demand)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteDemand(demand)}
            >
              <Trash2 className="size-4" />
              Excluir
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-w-0 pr-10">
        <DemandScheduleTrack demand={demand} />
      </div>

      <div className="mt-4 flex min-w-0 items-start gap-2 pr-2">
        <h3
          className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-slate-900"
          title={demand.descricao}
        >
          <span className="line-clamp-2 break-words">{demand.descricao}</span>
        </h3>
        {demand.status === "Concluído" ? (
          <div className="shrink-0 pt-0.5">
            <StatusBadge status={demand.status} />
          </div>
        ) : null}
      </div>

      <div
        className="mx-1 my-4 h-px bg-slate-200"
        role="separator"
        aria-hidden
      />

      <ul className="space-y-2.5 text-sm">
        <MetaRow icon={MapPin} value={demand.local} />
        <MetaRow icon={UserRound} value={demand.tecnico} />
        {demand.solicitante ? (
          <li className="min-w-0 pt-0.5 text-sm text-slate-600">
            <span className="text-slate-500">Solicitante: </span>
            <span className="break-words font-medium text-slate-800">
              {demand.solicitante}
            </span>
          </li>
        ) : null}
      </ul>
    </article>
  )
}
