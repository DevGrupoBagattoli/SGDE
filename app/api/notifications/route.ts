import { requireAuth } from "@/lib/server/auth"
import { jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export async function GET() {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        deliveries: {
          select: {
            channel: true,
            status: true,
            sentAt: true,
          },
        },
      },
    }),
    prisma.notification.count({
      where: { userId: auth.user.id, readAt: null },
    }),
  ])

  return jsonOk({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
      body: notification.body,
      demandId: notification.demandId,
      data: notification.data,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      ackAt: notification.ackAt ? notification.ackAt.toISOString() : null,
      deliveries: notification.deliveries.map((delivery) => ({
        channel: delivery.channel,
        status: delivery.status,
        sentAt: delivery.sentAt ? delivery.sentAt.toISOString() : null,
      })),
    })),
    unreadCount,
  })
}
