import { CheckCircle2, TimerReset, UsersRound } from "lucide-react"

export type DemandStatus = "Pendente" | "Em Andamento" | "Concluído"

/** Filtro do modal de resumo (card Total ou um status). */
export type SummaryDetailSegment = "total" | DemandStatus

export type Demand = {
  id: string
  tecnico: string
  equipe: string
  local: string
  descricao: string
  status: DemandStatus
  horarioInicio: string
  horarioFim: string
  duracaoPrevista: string
  observacoes: string
  participantes: string[]
  version: number
  dateKeys: string[]
}

/** Gestor filtra pelo técnico responsável; eletricista vê demandas onde é responsável ou participante. */
export type DashboardTechnicianFilterRole = "gestor" | "eletricista"

export const matchesTechnicianDashboardFilter = (
  demand: Demand,
  selectedTechnician: string,
  role: DashboardTechnicianFilterRole
) => {
  if (selectedTechnician === "Todos") return true
  if (role === "eletricista") {
    return (
      demand.tecnico === selectedTechnician ||
      demand.participantes.includes(selectedTechnician)
    )
  }
  return demand.tecnico === selectedTechnician
}

export const parseDurationDisplayMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{2}):(\d{2})h$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return null
  }
  const total = hours * 60 + minutes
  return total > 0 ? total : null
}

/** Lê `HH:MMh` ou texto tipo `2:30` / `02:30h` (ex.: dados antigos) para horas e minutos. */
export const parseDuracaoParts = (raw: string): { hours: number; minutes: number } => {
  const s = raw.trim().replace(/\s+/g, "").replace(/h$/i, "")
  if (!s) return { hours: 1, minutes: 0 }

  const m = /^(\d{1,3}):(\d{1,2})$/.exec(s)
  if (!m) return { hours: 1, minutes: 0 }

  let hours = Number.parseInt(m[1], 10)
  let minutes = Number.parseInt(m[2], 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return { hours: 1, minutes: 0 }

  hours = Math.min(99, Math.max(0, hours))
  minutes = Math.min(59, Math.max(0, minutes))

  if (hours === 0 && minutes === 0) return { hours: 1, minutes: 0 }

  return { hours, minutes }
}

/** Monta `HH:MMh` para a API a partir dos campos do formulário (0–99 h, 0–59 min). */
export const formatDuracaoFromParts = (hours: number, minutes: number): string => {
  const h = Math.min(99, Math.max(0, Math.floor(Number.isFinite(hours) ? hours : 0)))
  const min = Math.min(59, Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0)))
  if (h === 0 && min === 0) return "01:00h"
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}h`
}

export const predictedEndDate = (demand: Demand): Date => {
  const start = new Date(demand.horarioInicio)
  const fromDuration = parseDurationDisplayMinutes(demand.duracaoPrevista)
  if (fromDuration != null) {
    return new Date(start.getTime() + fromDuration * 60_000)
  }
  const end = new Date(demand.horarioFim)
  if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
    return end
  }
  return new Date(start.getTime() + 60 * 60_000)
}

export const mockDemands: Demand[] = [
  {
    id: "1",
    tecnico: "João Silva",
    equipe: "Alpha",
    local: "Bloco A - Condomínio Solar",
    descricao: "Troca de fiação do quadro de força principal",
    duracaoPrevista: "02:00h",
    horarioInicio: "2026-04-30T10:00:00",
    horarioFim: "2026-04-30T12:00:00",
    status: "Em Andamento",
    observacoes: "",
    participantes: [],
    version: 1,
    dateKeys: ["2026-04-30"],
  },
  {
    id: "2",
    tecnico: "Equipe Beta",
    equipe: "Beta",
    local: "Rua das Flores, 123",
    descricao: "Reparo em poste de iluminação interna",
    duracaoPrevista: "01:30h",
    horarioInicio: "2026-04-30T14:00:00",
    horarioFim: "2026-04-30T15:30:00",
    status: "Pendente",
    observacoes: "Aguardando chegada do material",
    participantes: [],
    version: 1,
    dateKeys: ["2026-04-30"],
  },
  {
    id: "3",
    tecnico: "Mariana Costa",
    equipe: "Gamma",
    local: "Galpão Logístico Norte",
    descricao: "Inspeção preventiva de disjuntores e aterramento",
    duracaoPrevista: "03:00h",
    horarioInicio: "2026-05-01T08:30:00",
    horarioFim: "2026-05-01T11:30:00",
    status: "Pendente",
    observacoes: "",
    participantes: [],
    version: 1,
    dateKeys: ["2026-05-01"],
  },
  {
    id: "4",
    tecnico: "Carlos Lima",
    equipe: "Alpha",
    local: "Hospital Municipal - Ala B",
    descricao: "Correção de oscilação no circuito de emergência",
    duracaoPrevista: "02:30h",
    horarioInicio: "2026-05-01T11:00:00",
    horarioFim: "2026-05-01T13:30:00",
    status: "Concluído",
    observacoes: "Teste final realizado com a manutenção local.",
    participantes: [],
    version: 1,
    dateKeys: ["2026-05-01"],
  },
]

export const statusLabels: DemandStatus[] = [
  "Pendente",
  "Em Andamento",
  "Concluído",
]

export const statusOptions = statusLabels

export const statusStyles: Record<
  DemandStatus,
  {
    badge: string
    border: string
    calendar: string
    dot: string
    icon: typeof CheckCircle2
    panel: string
  }
> = {
  Pendente: {
    badge: "bg-amber-100 text-amber-800 ring-amber-200",
    border: "border-l-amber-400",
    calendar: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-400",
    icon: TimerReset,
    panel: "bg-amber-50/70",
  },
  "Em Andamento": {
    badge: "bg-blue-100 text-blue-800 ring-blue-200",
    border: "border-l-blue-500",
    calendar: "border-blue-200 bg-blue-50 text-blue-900",
    dot: "bg-blue-500",
    icon: TimerReset,
    panel: "bg-blue-50/70",
  },
  Concluído: {
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    border: "border-l-emerald-500",
    calendar: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    panel: "bg-emerald-50/70",
  },
}

export const totalMetricIcon = UsersRound
