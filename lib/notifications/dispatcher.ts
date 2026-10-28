import { Prisma } from "@prisma/client"

import { emailChannel } from "@/lib/notifications/channels/email"
import { pushChannel } from "@/lib/notifications/channels/push"
import type {
  Channel,
  ChannelSendResult,
  NotificationChannel,
  NotificationInput,
  NotifyResult,
  Priority,
} from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

const channelImplementations: Record<Channel, NotificationChannel> = {
  PUSH: pushChannel,
  EMAIL: emailChannel,
}

/** Mesmo padrão de detecção de P2002 de `lib/server/users.ts`. */
const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

/** Decisão de canais: CRITICAL = push E e-mail (cada um se disponível); NORMAL = push, senão e-mail. */
export const decideChannels = (input: {
  hasPushSubscriptions: boolean
  hasEmail: boolean
  priority: Priority
}): Channel[] => {
  if (input.priority === "CRITICAL") {
    const channels: Channel[] = []
    if (input.hasPushSubscriptions) channels.push("PUSH")
    if (input.hasEmail) channels.push("EMAIL")
    return channels
  }
  return input.hasPushSubscriptions ? ["PUSH"] : input.hasEmail ? ["EMAIL"] : []
}

export const notify = async (input: NotificationInput): Promise<NotifyResult> => {
  // 1. Idempotência: a unique constraint em dedupeKey é a rede de segurança
  //    contra duas varreduras simultâneas (P2002 tratado abaixo).
  const existing = await prisma.notification.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { id: true },
  })

  if (existing) {
    return { skipped: true, notificationId: existing.id, channels: [] }
  }

  // 2. Cria a notificação (registro central do inbox).
  let notificationId: string

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        priority: input.priority,
        title: input.content.title,
        body: input.content.body,
        demandId: input.demandId,
        data: { url: input.content.url, tag: input.content.tag },
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    })

    notificationId = notification.id
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    // Corrida: outra varredura criou a mesma notificação entre o findUnique e o create.
    const raced = await prisma.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    })

    if (!raced) {
      throw error
    }

    return { skipped: true, notificationId: raced.id, channels: [] }
  }

  // 3. Carrega o destinatário: e-mail + subscriptions ativas.
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true,
      pushSubscriptions: {
        where: { revokedAt: null },
        select: { id: true },
      },
    },
  })

  // 4. Decide os canais.
  const channels = decideChannels({
    hasPushSubscriptions: (user?.pushSubscriptions.length ?? 0) > 0,
    hasEmail: Boolean(user?.email),
    priority: input.priority,
  })

  // 5. Registra e executa um delivery por canal.
  for (const channel of channels) {
    const delivery = await prisma.notificationDelivery.create({
      data: { notificationId, channel, status: "PENDING" },
      select: { id: true },
    })

    // Canais tratam suas próprias falhas e retornam { ok: false }; este
    // try/catch cobre exceções inesperadas (ex.: erro de banco dentro do
    // canal) para que o delivery não fique preso em PENDING.
    //
    // GUARDA: o veredito é gravado com updateMany condicionado a status PENDING.
    // Se a rota de status marcou a demanda DONE/CANCELLED durante o envio
    // (auto-cancel vira o delivery para CANCELLED), o update não casa nenhuma
    // linha e o CANCELLED sobrevive — evita push de demanda cancelada. O
    // updateMany não lança quando count = 0, que é justamente o comportamento
    // desejado.
    let result: ChannelSendResult

    try {
      result = await channelImplementations[channel].send({
        userId: input.userId,
        content: input.content,
        demandId: input.demandId,
        priority: input.priority,
      })
    } catch (error) {
      result = {
        channel,
        ok: false,
        error: `Erro inesperado no canal ${channel}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }
    }

    await prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: "PENDING" },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        attempts: { increment: 1 },
        lastError: result.ok ? null : (result.error ?? "Falha desconhecida no envio"),
        sentAt: result.ok ? new Date() : null,
      },
    })
  }

  return { skipped: false, notificationId, channels }
}
