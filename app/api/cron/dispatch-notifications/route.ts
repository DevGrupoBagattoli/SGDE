import crypto from "node:crypto"

import { dispatchPendingNotifications } from "@/lib/notifications/scheduler"
import { jsonError, jsonOk } from "@/lib/server/http"

const CRON_TOKEN_HEADER = "x-cron-token"

/** Comparação timing-safe: SHA-256 normaliza o tamanho dos segredos antes do timingSafeEqual. */
const isTokenValid = (provided: string, expected: string): boolean => {
  const providedDigest = crypto.createHash("sha256").update(provided).digest()
  const expectedDigest = crypto.createHash("sha256").update(expected).digest()

  return crypto.timingSafeEqual(providedDigest, expectedDigest)
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return jsonError(
      500,
      "CRON_NOT_CONFIGURED",
      "Agendador não configurado: defina CRON_SECRET no ambiente do servidor"
    )
  }

  const token = request.headers.get(CRON_TOKEN_HEADER)

  if (!token || !isTokenValid(token, secret)) {
    return jsonError(401, "UNAUTHORIZED", "Token do agendador ausente ou inválido")
  }

  return jsonOk(await dispatchPendingNotifications())
}
