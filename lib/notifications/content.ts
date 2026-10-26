import type { NotificationContent, NotificationEventType } from "@/lib/notifications/types"

export type NotificationDemand = {
  id: string
  descricao: string
  local: string
  inicioPrevisto: Date
}

export type DemandEventContext = {
  actorName?: string      // quem fez a alteração (eventos de demanda)
  statusLabel?: string    // "Pendente" | "Em Andamento" | ... (demandStatusFromDb)
  userName?: string       // quem clicou "Ciente" (ack)
  unseenUserName?: string // destinatário que não leu a notificação (escalonamento)
  unseenHours?: number    // horas sem leitura (escalonamento)
}

// As datas são persistidas como instantes UTC, mas os usuários estão no Brasil.
// O fuso fixo evita que o horário exibido mude conforme o fuso do servidor
// (um container em UTC mostraria 11:00 para um serviço previsto às 08:00).
const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

const formatTime = (date: Date): string => TIME_FORMATTER.format(date)

export const buildNotificationContent = (
  type: NotificationEventType,
  demand: NotificationDemand,
  context: DemandEventContext = {}
): NotificationContent => {
  const tag = `${type}:${demand.id}`

  switch (type) {
    case "SERVICE_UPCOMING":
      return {
        title: "Serviço começa em instantes",
        body: `${demand.local} — ${demand.descricao} (início previsto às ${formatTime(demand.inicioPrevisto)})`,
        url: "/dashboard",
        tag,
      }
    case "SERVICE_FINISH_REMINDER":
      return {
        title: "Serviço pendente de finalização",
        body: `"${demand.descricao}" passou do horário de fim previsto. Finalize no sistema.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_CREATED":
      return {
        title: "Novo chamado atribuído a você",
        body: `${demand.local} — ${demand.descricao} (início previsto às ${formatTime(demand.inicioPrevisto)}). Confira a duração prevista.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_SCHEDULE_CHANGED":
      return {
        title: "Horário do chamado alterado",
        body: `"${demand.descricao}" (${demand.local}): horário alterado por ${context.actorName}. Confira o novo horário.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_STATUS_CHANGED":
      return {
        title: "Status do chamado alterado",
        body: `"${demand.descricao}" (${demand.local}): novo status ${context.statusLabel} (alterado por ${context.actorName}).`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_CANCELLED":
      return {
        title: "Chamado cancelado",
        body: `"${demand.descricao}" (${demand.local}) foi cancelado por ${context.actorName}.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_DESCRIPTION_CHANGED":
      return {
        title: "Descrição do chamado alterada",
        body: `"${demand.descricao}" (${demand.local}): descrição alterada por ${context.actorName}.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_DELETED":
      return {
        title: "Chamado excluído",
        body: `"${demand.descricao}" (${demand.local}) foi excluído por ${context.actorName}.`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_ACK_CONFIRMED":
      return {
        title: "Chamado confirmado pelo técnico",
        body: `${context.userName} está ciente do chamado "${demand.descricao}" (${demand.local}).`,
        url: "/dashboard",
        tag,
      }
    case "DEMAND_UNSEEN_ESCALATION":
      return {
        title: "Chamado ainda não visto",
        body: `"${demand.descricao}" (${demand.local}) está há ${context.unseenHours}h sem ser visto por ${context.unseenUserName}. Considere ligar ou enviar mensagem.`,
        url: "/dashboard",
        tag,
      }
  }
}
