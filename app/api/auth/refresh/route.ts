import { rotateRefreshSession, roleFromDb } from "@/lib/server/auth"
import { jsonOk } from "@/lib/server/http"

export async function POST() {
  const rotated = await rotateRefreshSession()

  if (rotated.error) {
    return rotated.error
  }

  return jsonOk({
    name: rotated.user.name,
    role: roleFromDb(rotated.user.role),
  })
}
