import { clearSessionCookies, rotateRefreshSession, roleFromDb } from "@/lib/server/auth"
import { jsonOk } from "@/lib/server/http"

export async function POST() {
  const rotated = await rotateRefreshSession()

  if (rotated.error) {
    // Sessão inválida: limpa os cookies para o proxy não devolver /login → /dashboard em loop.
    await clearSessionCookies()
    return rotated.error
  }

  return jsonOk({
    name: rotated.user.name,
    role: roleFromDb(rotated.user.role),
  })
}
