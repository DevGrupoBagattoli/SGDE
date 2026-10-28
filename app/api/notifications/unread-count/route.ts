import { requireAuth } from "@/lib/server/auth"
import { jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export async function GET() {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: auth.user.id, readAt: null },
  })

  return jsonOk({ unreadCount })
}
