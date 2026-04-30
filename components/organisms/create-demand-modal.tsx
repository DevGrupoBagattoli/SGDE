"use client"

import { FormEvent, useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserSession } from "@/lib/auth"
import { Demand, DemandStatus, statusOptions } from "@/lib/demands"

type CreateDemandInput = Omit<Demand, "id">

type CreateDemandModalProps = {
  currentTechnician?: string
  session: UserSession
  technicians: string[]
  onClose: () => void
  onCreate: (demand: CreateDemandInput) => void
}

export function CreateDemandModal({
  currentTechnician,
  session,
  technicians,
  onClose,
  onCreate,
}: CreateDemandModalProps) {
  const initialTechnician = useMemo(() => {
    if (session.role === "eletricista") {
      return session.name
    }

    return currentTechnician && currentTechnician !== "Todos"
      ? currentTechnician
      : technicians[0] ?? ""
  }, [currentTechnician, session.name, session.role, technicians])

  const [tecnico, setTecnico] = useState(initialTechnician)
  const [equipe, setEquipe] = useState("")
  const [local, setLocal] = useState("")
  const [descricao, setDescricao] = useState("")
  const [horarioInicio, setHorarioInicio] = useState("")
  const [duracaoPrevista, setDuracaoPrevista] = useState("01:00h")
  const [status, setStatus] = useState<DemandStatus>("Pendente")
  const [observacoes, setObservacoes] = useState("")

  const isTechnicianLocked = session.role === "eletricista"

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    onCreate({
      tecnico,
      equipe: equipe.trim() || "Sem equipe",
      local: local.trim(),
      descricao: descricao.trim(),
      horarioInicio: new Date(horarioInicio).toISOString(),
      duracaoPrevista,
      status,
      observacoes: observacoes.trim(),
    })
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <form
        className="max-h-[90svh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Criar chamado</h2>
            <p className="mt-1 text-sm text-slate-500">
              Preencha os dados para inserir a demanda no calendário.
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

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Eletricista
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
              disabled={isTechnicianLocked}
              required
              value={tecnico}
              onChange={(event) => setTecnico(event.target.value)}
            >
              {technicians.map((technician) => (
                <option key={technician} value={technician}>
                  {technician}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Equipe
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Alpha"
              value={equipe}
              onChange={(event) => setEquipe(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            Local
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Bloco, rua, cliente ou unidade"
              required
              value={local}
              onChange={(event) => setLocal(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            Descrição
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Descreva o atendimento solicitado."
              required
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Dia e horário
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              type="datetime-local"
              value={horarioInicio}
              onChange={(event) => setHorarioInicio(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Duração prevista
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="01:00h"
              required
              value={duracaoPrevista}
              onChange={(event) => setDuracaoPrevista(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Status inicial
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as DemandStatus)
              }
            >
              {statusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Observações
            <input
              className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Opcional"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Criar chamado</Button>
        </div>
      </form>
    </div>
  )
}
