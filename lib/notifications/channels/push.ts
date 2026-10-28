import webpush from "web-push"

import type {
  ChannelSendInput,
  ChannelSendResult,
  NotificationChannel,
} from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

// Timeout do socket: o canal é awaited no caminho da requisição (mutações de
// demanda); um hang no push service não pode travar a resposta HTTP.
const PUSH_TIMEOUT_MS = 10_000

// Configuração VAPID lazy: `setVapidDetails` valida as chaves e lança erro se
// estiverem ausentes — chamá-la no top-level quebraria a importação do módulo
// em testes/ambientes sem env. Configura uma única vez por processo.
let vapidConfigured = false

const configureVapid = () => {
  if (vapidConfigured) return

  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "VAPID não configurada: defina VAPID_SUBJECT, VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY"
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

const getStatusCode = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null
  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === "number" ? statusCode : null
}

const describeError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export const pushChannel: NotificationChannel = {
  channel: "PUSH",
  async send({ userId, content, priority }: ChannelSendInput): Promise<ChannelSendResult> {
    try {
      configureVapid()
    } catch (error) {
      return { channel: "PUSH", ok: false, error: describeError(error) }
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId, revokedAt: null },
    })

    if (subscriptions.length === 0) {
      return { channel: "PUSH", ok: false, error: "Nenhuma subscription ativa" }
    }

    const payload = JSON.stringify({
      ...content,
      requireInteraction: priority === "CRITICAL",
    })

    // `async` no map converte throws síncronos do web-push em rejeições,
    // garantindo que o allSettled capture todas as falhas.
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { timeout: PUSH_TIMEOUT_MS }
        )
      )
    )

    const expiredEndpoints: string[] = []
    const failureMessages: string[] = []

    results.forEach((result, index) => {
      if (result.status === "fulfilled") return

      const statusCode = getStatusCode(result.reason)

      // 404/410 = subscription expirou ou foi invalidada pelo push service.
      if (statusCode === 404 || statusCode === 410) {
        expiredEndpoints.push(subscriptions[index].endpoint)
      }

      failureMessages.push(statusCode ? `HTTP ${statusCode}` : describeError(result.reason))
    })

    // Limpeza best-effort: a subscription pode já ter sido removida em outra varredura.
    for (const endpoint of expiredEndpoints) {
      try {
        await prisma.pushSubscription.delete({ where: { endpoint } })
      } catch {
        // Ignora: o objetivo é apenas não acumular subscriptions mortas.
      }
    }

    if (results.some((result) => result.status === "fulfilled")) {
      return { channel: "PUSH", ok: true }
    }

    const summary = failureMessages.slice(0, 3).join("; ")

    return {
      channel: "PUSH",
      ok: false,
      error: summary ? `Falha no envio do push: ${summary}` : "Falha no envio do push",
    }
  },
}
