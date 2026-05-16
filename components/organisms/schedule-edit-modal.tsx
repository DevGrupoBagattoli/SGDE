"use client"

import { FormEvent, useState } from "react"
import { UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Demand,
  formatDuracaoFromParts,
  parseDuracaoParts,
} from "@/lib/demands"

type ScheduleEditModalProps = {
  allTechnicians: string[]
  demand: Demand
  descricaoValue?: string
  error: string
  isSaving?: boolean
  observationValue: string
  scheduleValue: string
  onClose: () => void
  onDescricaoChange?: (value: string) => void
  onObservationChange: (value: string) => void
  onScheduleChange: (value: string) => void
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    participantes: string[],
    duracaoPrevista: string
  ) => Promise<void> | void
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(Number.isFinite(n) ? n : 0)))

export function ScheduleEditModal(props: ScheduleEditModalProps) {
  const { demand } = props
  return (
    <ScheduleEditModalForm
      key={demand.id}
      {...props}
    />
  )
}

function ScheduleEditModalForm({
  allTechnicians,
  demand,
  descricaoValue,
  error,
  isSaving = false,
  observationValue,
  scheduleValue,
  onClose,
  onDescricaoChange,
  onObservationChange,
  onScheduleChange,
  onSubmit,
}: ScheduleEditModalProps) {
  const [participantes, setParticipantes] = useState<string[]>(
    demand.participantes ?? []
  )
  const initialDur = parseDuracaoParts(demand.duracaoPrevista)
  const [durHours, setDurHours] = useState(initialDur.hours)
  const [durMinutes, setDurMinutes] = useState(initialDur.minutes)
  const [selectedToAdd, setSelectedToAdd] = useState("")

  const duracaoPreview = formatDuracaoFromParts(durHours, durMinutes)

  const available = allTechnicians.filter(
    (t) => t !== demand.tecnico && !participantes.includes(t)
  )

  const handleAdd = () => {
    const technician = selectedToAdd || available[0]
    if (!technician) return
    setParticipantes((prev) => [...prev, technician])
    setSelectedToAdd("")
  }

  const handleRemove = (name: string) => {
    setParticipantes((prev) => prev.filter((p) => p !== name))
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <form
        className="max-h-[90svh] w-full max-w-lg overflow-x-hidden overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
        onSubmit={(e) =>
          onSubmit(e, participantes, duracaoPreview)
        }
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

        {descricaoValue != null && onDescricaoChange ? (
          <div className="mt-6 grid gap-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="demand-descricao">
              Descrição
            </label>
            <textarea
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              id="demand-descricao"
              rows={3}
              value={descricaoValue}
              onChange={(event) => onDescricaoChange(event.target.value)}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                Duração prevista
              </span>
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid w-23 gap-1.5 text-xs font-medium text-slate-500">
                  Horas
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="numeric"
                    max={99}
                    min={0}
                    type="number"
                    value={durHours}
                    onChange={(event) =>
                      setDurHours(
                        clamp(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value),
                          0,
                          99,
                        ),
                      )
                    }
                  />
                </label>
                <label className="grid w-23 gap-1.5 text-xs font-medium text-slate-500">
                  Minutos
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="numeric"
                    max={59}
                    min={0}
                    type="number"
                    value={durMinutes}
                    onChange={(event) =>
                      setDurMinutes(
                        clamp(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value),
                          0,
                          59,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Máx. 99 h e 59 min. Registro:{" "}
                <span className="font-medium text-slate-700">{duracaoPreview}</span>
              </p>
            </div>
          </div>

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

          <div className="grid gap-3">
            <p className="text-sm font-medium text-slate-700">
              Participantes adicionais
            </p>

            {participantes.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {participantes.map((name) => (
                  <li
                    key={name}
                    className="flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200"
                  >
                    <span className="truncate">{name}</span>
                    <button
                      aria-label={`Remover ${name}`}
                      className="ml-0.5 rounded-full text-blue-500 hover:text-blue-800"
                      type="button"
                      onClick={() => handleRemove(name)}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                Nenhum participante adicionado.
              </p>
            )}

            {available.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Selecionar participante"
                  className="h-10 min-w-0 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:flex-1"
                  value={selectedToAdd}
                  onChange={(e) => setSelectedToAdd(e.target.value)}
                >
                  <option value="">Selecionar eletricista...</option>
                  {available.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full shrink-0 sm:w-auto"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleAdd}
                >
                  <UserPlus className="size-4" />
                  Adicionar
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando…" : "Salvar alteração"}
          </Button>
        </div>
      </form>
    </div>
  )
}
