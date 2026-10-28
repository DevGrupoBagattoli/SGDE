import { notifyDemandAck } from "@/lib/notifications/demand-events"
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
    select: { id: true, readAt: true, ackAt: true, demandId: true },
  })

  if (!notification) {
    return jsonError(404, "NOT_FOUND", "Notificação não encontrada para o identificador informado", {
      notificationId: id,
    })
  }

  const isFirstAck = notification.ackAt === null
  const ackAt = new Date()
  const readAt = notification.readAt ?? ackAt

  await prisma.notification.update({
    where: { id: notification.id },
    data: { ackAt, readAt },
  })

  if (isFirstAck && notification.demandId) {
    await notifyDemandAck({
      notificationId: notification.id,
      demandId: notification.demandId,
      ackUserId: auth.user.id,
      ackUserName: auth.user.name,
    })
  }

  return jsonOk({
    notificationId: notification.id,
    ackAt: ackAt.toISOString(),
    readAt: readAt.toISOString(),
  })
}
