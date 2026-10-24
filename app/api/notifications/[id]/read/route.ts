import { requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { jsonError, jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, { params }: RouteParams) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params

  const notification = await prisma.notification.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, readAt: true },
  })

  if (!notification) {
    return jsonError(404, "NOT_FOUND", "Notificação não encontrada para o identificador informado", {
      notificationId: id,
    })
  }

  if (notification.readAt) {
    return jsonOk({
      notificationId: notification.id,
      readAt: notification.readAt.toISOString(),
    })
  }

  const readAt = new Date()

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt },
  })

  return jsonOk({
    notificationId: notification.id,
    readAt: readAt.toISOString(),
  })
}
