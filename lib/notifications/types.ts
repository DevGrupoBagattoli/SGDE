export type Channel = "PUSH" | "EMAIL"
export type Priority = "NORMAL" | "CRITICAL"

export type DemandEventType =
  | "DEMAND_CREATED"
  | "DEMAND_SCHEDULE_CHANGED"
  | "DEMAND_STATUS_CHANGED"
  | "DEMAND_CANCELLED"
  | "DEMAND_DESCRIPTION_CHANGED"
  | "DEMAND_DELETED"

export type NotificationEventType =
  | "SERVICE_UPCOMING"
  | "SERVICE_FINISH_REMINDER"
  | DemandEventType
  | "DEMAND_ACK_CONFIRMED"
  | "DEMAND_UNSEEN_ESCALATION"

export type NotificationContent = {
  title: string
  body: string
  url: string // para onde o clique leva
  tag?: string // agrupa/substitui notificações no Android (por demanda+evento)
}

export type NotificationInput = {
  userId: string
  type: NotificationEventType
  priority: Priority
  demandId?: string
  content: NotificationContent
  dedupeKey: string
}

export type ChannelSendInput = {
  userId: string
  content: NotificationContent
  demandId?: string
  priority: Priority
}

export type ChannelSendResult = {
  channel: Channel
  ok: boolean
  error?: string
}

export interface NotificationChannel {
  readonly channel: Channel
  send(input: ChannelSendInput): Promise<ChannelSendResult>
}

export type NotifyResult = {
  skipped: boolean // true = já existia (idempotência)
  notificationId: string
  channels: Channel[] // canais efetivamente utilizados
}
