import { clearSessionCookies, requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export async function POST() {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (!auth.error) {
    await prisma.session.updateMany({
      where: {
        userId: auth.user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  await clearSessionCookies()

  return jsonOk({ loggedOut: true })
}
