import { roleLabels, type UserRole } from "@/lib/auth"

/** Rótulos de ação de auditoria (chave = valor gravado no banco). */
export const auditActionLabels: Record<string, string> = {
  CREATE: "Criação",
  UPDATE_STATUS: "Alteração de status",
  UPDATE_SCHEDULE: "Alteração de horário",
  UPDATE: "Alteração de descrição",
  DELETE: "Exclusão",
  ADD_PARTICIPANT: "Adição de participante",
  REMOVE_PARTICIPANT: "Remoção de participante",
}

/** Rótulos de campo alterado (chave = `field` no banco). */
export const auditFieldLabels: Record<string, string> = {
  status: "Status",
  inicioPrevisto: "Início previsto",
  fimPrevisto: "Fim previsto",
  duracaoMinutos: "Duração",
  descricao: "Descrição",
  participantes: "Participantes",
  participant: "Participante",
  "*": "Geral",
}

/** Status da demanda como enum Prisma → rótulo da UI. */
export const auditDemandStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
}

const auditDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatAuditRole(role: string): string {
  if (role in roleLabels) {
    return roleLabels[role as UserRole]
  }
  return role
}

export function formatAuditAction(action: string): string {
  return auditActionLabels[action] ?? action
}

export function formatAuditField(field: string): string {
  return auditFieldLabels[field] ?? field
}

/** Traduz valores exibidos em “De / para”, conforme o campo alterado. */
export function formatAuditValue(field: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value

  if (field === "status") {
    return auditDemandStatusLabels[trimmed] ?? trimmed
  }

  if (field === "inicioPrevisto" || field === "fimPrevisto") {
    const date = new Date(trimmed)
    if (!Number.isNaN(date.getTime())) {
      return auditDateFormatter.format(date)
    }
  }

  return value
}
