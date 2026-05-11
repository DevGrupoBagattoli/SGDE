import { cookies, headers } from "next/headers"

import { jsonError } from "@/lib/server/http"

export const CSRF_COOKIE_NAME = "sgde_csrf"

export const validateCsrf = async () => {
  const cookieStore = await cookies()
  const headersStore = await headers()

  const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME)?.value
  const csrfHeader = headersStore.get("x-csrf-token")

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return jsonError(403, "FORBIDDEN", "Falha na validação de CSRF; atualize a página e tente novamente", {
      hasCsrfCookie: Boolean(csrfCookie),
      hasCsrfHeader: Boolean(csrfHeader),
      reason: "Token CSRF ausente ou divergente entre cookie e header",
    })
  }

  return null
}
