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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Detalhes dos atendimentos
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Lista de apoio para alterar status e horários rapidamente.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {demands.length} atendimento{demands.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {demands.map((demand) => (
          <DemandCard
            demand={demand}
            key={demand.id}
            onEditSchedule={onEditSchedule}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </div>

      {demands.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma demanda encontrada para o filtro atual.
        </div>
      ) : null}
    </section>
  )
}
