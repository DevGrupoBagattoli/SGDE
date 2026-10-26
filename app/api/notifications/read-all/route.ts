import { requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export async function POST() {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const { count } = await prisma.notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  })

  return jsonOk({ updatedCount: count })
}
