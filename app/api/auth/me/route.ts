import { requireAuth, roleFromDb } from "@/lib/server/auth"
import { jsonOk } from "@/lib/server/http"

export async function GET() {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  return jsonOk({
    name: auth.user.name,
    role: roleFromDb(auth.user.role),
  })
}
