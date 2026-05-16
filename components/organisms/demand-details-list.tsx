"use client"

import { DemandCard } from "@/components/molecules/demand-card"
import { Demand, DemandStatus } from "@/lib/demands"

type DemandDetailsListProps = {
  demands: Demand[]
  isManager?: boolean
  onDeleteDemand?: (demand: Demand) => void
  onEditSchedule: (demand: Demand) => void
  onUpdateStatus: (id: string, status: DemandStatus) => Promise<void> | void
}

export function DemandDetailsList({
  demands,
  isManager,
  onDeleteDemand,
  onEditSchedule,
  onUpdateStatus,
}: DemandDetailsListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold">Detalhes dos atendimentos</h2>
        <p className="text-sm text-slate-500">
          Lista de apoio para alterar status e horários rapidamente.
        </p>
      </div>

      {demands.length === 0 ? (
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
          Nenhum atendimento encontrado com o filtro atual.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {demands.map((demand) => (
            <DemandCard
              demand={demand}
              isManager={isManager}
              key={demand.id}
              onDeleteDemand={onDeleteDemand}
              onEditSchedule={onEditSchedule}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </div>
      )}
    </section>
  )
}
