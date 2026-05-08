import { CheckCircle2, TimerReset, UsersRound } from "lucide-react"

export type DemandStatus = "Pendente" | "Em Andamento" | "Concluído"

export type Demand = {
  id: string
  tecnico: string
  equipe: string
  local: string
  descricao: string
  status: DemandStatus
  horarioInicio: string
  duracaoPrevista: string
  observacoes: string
  participantes: string[]
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
    status: "Em Andamento",
    observacoes: "",
    participantes: [],
  },
  {
    id: "2",
    tecnico: "Equipe Beta",
    equipe: "Beta",
    local: "Rua das Flores, 123",
    descricao: "Reparo em poste de iluminação interna",
    duracaoPrevista: "01:30h",
    horarioInicio: "2026-04-30T14:00:00",
    status: "Pendente",
    observacoes: "Aguardando chegada do material",
    participantes: [],
  },
  {
    id: "3",
    tecnico: "Mariana Costa",
    equipe: "Gamma",
    local: "Galpão Logístico Norte",
    descricao: "Inspeção preventiva de disjuntores e aterramento",
    duracaoPrevista: "03:00h",
    horarioInicio: "2026-05-01T08:30:00",
    status: "Pendente",
    observacoes: "",
    participantes: [],
  },
  {
    id: "4",
    tecnico: "Carlos Lima",
    equipe: "Alpha",
    local: "Hospital Municipal - Ala B",
    descricao: "Correção de oscilação no circuito de emergência",
    duracaoPrevista: "02:30h",
    horarioInicio: "2026-05-01T11:00:00",
    status: "Concluído",
    observacoes: "Teste final realizado com a manutenção local.",
    participantes: [],
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
