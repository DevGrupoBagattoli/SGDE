import type { NotificationContent, NotificationEventType } from "@/lib/notifications/types"

export type NotificationDemand = {
  id: string
  descricao: string
  local: string
  inicioPrevisto: Date
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
  demand: NotificationDemand
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
  }
}
