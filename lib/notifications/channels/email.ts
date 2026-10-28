import type {
  ChannelSendInput,
  ChannelSendResult,
  NotificationChannel,
} from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

const BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email"

// Timeout do fetch: o canal é awaited no caminho da requisição (mutações de
// demanda); sem signal, um hang da Brevo (undici ~5min) travaria a resposta HTTP.
const BREVO_TIMEOUT_MS = 10_000

export const emailChannel: NotificationChannel = {
  channel: "EMAIL",
  async send({ userId, content }: ChannelSendInput): Promise<ChannelSendResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user?.email) {
      return { channel: "EMAIL", ok: false, error: "Usuário sem e-mail cadastrado" }
    }

    const apiKey = process.env.BREVO_API_KEY
    const senderEmail = process.env.BREVO_SENDER_EMAIL

    if (!apiKey) {
      return { channel: "EMAIL", ok: false, error: "BREVO_API_KEY não configurada" }
    }

    if (!senderEmail) {
      return { channel: "EMAIL", ok: false, error: "BREVO_SENDER_EMAIL não configurada" }
    }

    try {
      const response = await fetch(BREVO_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME || "SGDE",
            email: senderEmail,
          },
          to: [{ email: user.email }],
          subject: content.title,
          textContent: content.body,
        }),
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        return {
          channel: "EMAIL",
          ok: false,
          error: `Brevo respondeu ${response.status}: ${body.slice(0, 200)}`,
        }
      }

      return { channel: "EMAIL", ok: true }
    } catch (error) {
      // Falha de rede/DNS não deve derrubar o agendador: vira delivery FAILED.
      return {
        channel: "EMAIL",
        ok: false,
        error: `Falha de rede ao contatar a Brevo: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
