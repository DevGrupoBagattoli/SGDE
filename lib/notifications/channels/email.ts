import type {
  ChannelSendInput,
  ChannelSendResult,
  NotificationChannel,
} from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

const BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email"

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

    if (!apiKey) {
      return { channel: "EMAIL", ok: false, error: "BREVO_API_KEY não configurada" }
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
            email: process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email: user.email }],
          subject: content.title,
          textContent: content.body,
        }),
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
