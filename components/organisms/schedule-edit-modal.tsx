"use client"

import { FormEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Demand } from "@/lib/demands"

type ScheduleEditModalProps = {
  demand: Demand
  error: string
  observationValue: string
  scheduleValue: string
  onClose: () => void
  onObservationChange: (value: string) => void
  onScheduleChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ScheduleEditModal({
  demand,
  error,
  observationValue,
  scheduleValue,
  onClose,
  onObservationChange,
  onScheduleChange,
  onSubmit,
}: ScheduleEditModalProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Editar agenda</h2>
            <p className="mt-1 text-sm text-slate-500">
              {demand.tecnico} · {demand.local}
            </p>
          </div>
          <Button
            aria-label="Fechar modal"
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Novo dia e horário
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              type="datetime-local"
              value={scheduleValue}
              onChange={(event) => onScheduleChange(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Observações
            <textarea
              className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Descreva o motivo da alteração."
              value={observationValue}
              onChange={(event) => onObservationChange(event.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar alteração</Button>
        </div>
      </form>
    </div>
  )
}
