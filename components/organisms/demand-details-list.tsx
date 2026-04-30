"use client"

import { DemandCard } from "@/components/molecules/demand-card"
import { Demand, DemandStatus } from "@/lib/demands"

type DemandDetailsListProps = {
  demands: Demand[]
  onEditSchedule: (demand: Demand) => void
  onUpdateStatus: (id: string, status: DemandStatus) => void
}

export function DemandDetailsList({
  demands,
  onEditSchedule,
  onUpdateStatus,
}: DemandDetailsListProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold">Detalhes dos atendimentos</h2>
        <p className="text-sm text-slate-500">
          Lista de apoio para alterar status e horários rapidamente.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {demands.map((demand) => (
          <DemandCard
            demand={demand}
            key={demand.id}
            onEditSchedule={onEditSchedule}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </div>
    </section>
  )
}
