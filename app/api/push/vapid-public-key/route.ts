import { requireAuth } from "@/lib/server/auth"
import { jsonError, jsonOk } from "@/lib/server/http"

export async function GET() {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY

  if (!publicKey) {
    return jsonError(
      500,
      "VAPID_NOT_CONFIGURED",
      "Notificações push indisponíveis: a variável VAPID_PUBLIC_KEY não está configurada no servidor; gere as chaves com `pnpm run push:generate-keys`",
      { missingEnv: "VAPID_PUBLIC_KEY" }
    )
  }

  return jsonOk({ publicKey })
}
