import { buildNotificationContent } from "@/lib/notifications/content"
import { notify } from "@/lib/notifications/dispatcher"
import {
  buildDemandEventDedupeKey,
  excludeActor,
  resolvePriority,
  resolveRecipients,
} from "@/lib/notifications/events"
import type { DemandEventType } from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

type DemandWithRecipients = {
  id: string
  version: number
  descricao: string
  local: string
  inicioPrevisto: Date
  technician: { id: string }
  participants: Array<{ user: { id: string } }>
}

/** Notifica técnico + participantes (menos o autor) sobre um evento de demanda. Best-effort. */
export const notifyDemandEvent = async (input: {
  type: DemandEventType
  demand: DemandWithRecipients
  actorId: string
  actorName: string
  statusLabel?: string
}): Promise<void> => {
  const recipients = excludeActor(resolveRecipients(input.demand), input.actorId)

  for (const recipient of recipients) {
    try {
      await notify({
        userId: recipient.id,
        type: input.type,
        priority: resolvePriority(input.type),
        demandId: input.demand.id,
        content: buildNotificationContent(input.type, input.demand, {
          actorName: input.actorName,
          statusLabel: input.statusLabel,
        }),
        dedupeKey: buildDemandEventDedupeKey(
          input.type,
          input.demand.id,
          recipient.id,
          input.demand.version
        ),
      })
    } catch (error) {
      console.error(`[notifications] falha no evento ${input.type} (demanda ${input.demand.id})`, error)
    }
  }
}

/** Notifica o CRIADOR da demanda que o eletricista confirmou ("Ciente"). Best-effort. */
export const notifyDemandAck = async (input: {
  notificationId: string
  demandId: string
  ackUserId: string
  ackUserName: string
}): Promise<void> => {
  try {
    const demand = await prisma.demand.findUnique({ where: { id: input.demandId } })
    if (!demand || demand.createdById === input.ackUserId) return

    await notify({
      userId: demand.createdById,
      type: "DEMAND_ACK_CONFIRMED",
      priority: resolvePriority("DEMAND_ACK_CONFIRMED"),
      demandId: demand.id,
      content: buildNotificationContent("DEMAND_ACK_CONFIRMED", demand, {
        userName: input.ackUserName,
      }),
      dedupeKey: `DEMAND_ACK_CONFIRMED:${input.notificationId}:${demand.createdById}`,
    })
  } catch (error) {
    console.error(`[notifications] falha no ack (demanda ${input.demandId})`, error)
  }
}
