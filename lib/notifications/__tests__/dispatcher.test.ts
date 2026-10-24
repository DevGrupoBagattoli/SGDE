import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Prisma } from "@prisma/client"

import { emailChannel } from "@/lib/notifications/channels/email"
import { pushChannel } from "@/lib/notifications/channels/push"
import { decideChannels, notify } from "@/lib/notifications/dispatcher"
import type { NotificationInput } from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

// As factories não podem referenciar variáveis externas (hoisting do jest.mock):
// cada mock nasce dentro da factory e é tipado depois via cast.
jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    notification: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    notificationDelivery: {
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("@/lib/notifications/channels/push", () => ({
  pushChannel: {
    channel: "PUSH",
    send: jest.fn(),
  },
}))

jest.mock("@/lib/notifications/channels/email", () => ({
  emailChannel: {
    channel: "EMAIL",
    send: jest.fn(),
  },
}))

type AsyncMock<TResult, TArgs extends unknown[] = unknown[]> = jest.Mock<
  (...args: TArgs) => Promise<TResult>
>

type UserLookup = {
  email: string | null
  pushSubscriptions: Array<{ id: string }>
}

type PrismaMock = {
  notification: {
    findUnique: AsyncMock<{ id: string } | null>
    create: AsyncMock<{ id: string }>
  }
  notificationDelivery: {
    create: AsyncMock<{ id: string }>
    update: AsyncMock<{ id: string }>
  }
  user: {
    findUnique: AsyncMock<UserLookup | null>
  }
}

const prismaMock = prisma as unknown as PrismaMock
const pushSendMock = jest.mocked(pushChannel.send)
const emailSendMock = jest.mocked(emailChannel.send)

const INPUT: NotificationInput = {
  userId: "user-1",
  type: "SERVICE_UPCOMING",
  priority: "NORMAL",
  demandId: "demand-1",
  content: {
    title: "Serviço começa em instantes",
    body: "Subestação X — Manutenção preventiva (início previsto às 08:00)",
    url: "/dashboard",
    tag: "SERVICE_UPCOMING:demand-1",
  },
  dedupeKey: "SERVICE_UPCOMING:demand-1:user-1",
}

beforeEach(() => {
  jest.resetAllMocks()

  prismaMock.notification.findUnique.mockResolvedValue(null)
  prismaMock.notification.create.mockResolvedValue({ id: "notification-1" })
  prismaMock.notificationDelivery.create.mockResolvedValue({ id: "delivery-1" })
  prismaMock.notificationDelivery.update.mockResolvedValue({ id: "delivery-1" })
  prismaMock.user.findUnique.mockResolvedValue({
    email: null,
    pushSubscriptions: [],
  })

  pushSendMock.mockResolvedValue({ channel: "PUSH", ok: true })
  emailSendMock.mockResolvedValue({ channel: "EMAIL", ok: true })
})

describe("decideChannels", () => {
  it("usa PUSH quando há subscription ativa (mesmo com e-mail cadastrado)", () => {
    expect(
      decideChannels({ hasPushSubscriptions: true, hasEmail: true })
    ).toEqual(["PUSH"])
  })

  it("usa EMAIL quando não há push mas há e-mail (fallback)", () => {
    expect(
      decideChannels({ hasPushSubscriptions: false, hasEmail: true })
    ).toEqual(["EMAIL"])
  })

  it("não decide canal quando não há push nem e-mail", () => {
    expect(
      decideChannels({ hasPushSubscriptions: false, hasEmail: false })
    ).toEqual([])
  })
})

describe("notify — idempotência", () => {
  it("retorna skipped e não cria nada quando o dedupeKey já existe", async () => {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: "notification-existente",
    })

    const result = await notify(INPUT)

    expect(result).toEqual({
      skipped: true,
      notificationId: "notification-existente",
      channels: [],
    })
    expect(prismaMock.notification.findUnique).toHaveBeenCalledWith({
      where: { dedupeKey: INPUT.dedupeKey },
      select: { id: true },
    })
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(prismaMock.notificationDelivery.create).not.toHaveBeenCalled()
    expect(pushSendMock).not.toHaveBeenCalled()
    expect(emailSendMock).not.toHaveBeenCalled()
  })

  it("trata P2002 do create como skipped (corrida entre varreduras)", async () => {
    prismaMock.notification.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "notification-corrida" })
    prismaMock.notification.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`dedupeKey`)",
        {
          code: "P2002",
          clientVersion: "6.17.1",
          meta: { target: ["dedupeKey"] },
        }
      )
    )

    const result = await notify(INPUT)

    expect(result).toEqual({
      skipped: true,
      notificationId: "notification-corrida",
      channels: [],
    })
    expect(prismaMock.notification.findUnique).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificationDelivery.create).not.toHaveBeenCalled()
    expect(pushSendMock).not.toHaveBeenCalled()
    expect(emailSendMock).not.toHaveBeenCalled()
  })

  it("propaga erro do create que não seja P2002", async () => {
    prismaMock.notification.create.mockRejectedValue(
      new Error("conexão com o banco indisponível")
    )

    await expect(notify(INPUT)).rejects.toThrow(
      "conexão com o banco indisponível"
    )
    expect(prismaMock.notificationDelivery.create).not.toHaveBeenCalled()
  })
})

describe("notify — decisão de canais e deliveries", () => {
  it("cria notificação e delivery PUSH e marca SENT quando o canal tem sucesso", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: null,
      pushSubscriptions: [{ id: "sub-1" }],
    })
    pushSendMock.mockResolvedValue({ channel: "PUSH", ok: true })

    const result = await notify(INPUT)

    expect(result).toEqual({
      skipped: false,
      notificationId: "notification-1",
      channels: ["PUSH"],
    })
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "SERVICE_UPCOMING",
        priority: "NORMAL",
        title: INPUT.content.title,
        body: INPUT.content.body,
        demandId: "demand-1",
        data: {
          url: "/dashboard",
          tag: "SERVICE_UPCOMING:demand-1",
        },
        dedupeKey: INPUT.dedupeKey,
      }),
      select: { id: true },
    })
    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledWith({
      data: {
        notificationId: "notification-1",
        channel: "PUSH",
        status: "PENDING",
      },
      select: { id: true },
    })
    expect(pushSendMock).toHaveBeenCalledWith({
      userId: "user-1",
      content: INPUT.content,
      demandId: "demand-1",
    })
    expect(prismaMock.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        lastError: null,
        sentAt: expect.any(Date),
      },
    })
  })

  it("usa EMAIL como fallback e marca FAILED com lastError quando o canal falha", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: "eletricista@example.com",
      pushSubscriptions: [],
    })
    emailSendMock.mockResolvedValue({
      channel: "EMAIL",
      ok: false,
      error: "Brevo respondeu 500",
    })

    const result = await notify(INPUT)

    expect(result).toEqual({
      skipped: false,
      notificationId: "notification-1",
      channels: ["EMAIL"],
    })
    expect(pushSendMock).not.toHaveBeenCalled()
    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledWith({
      data: {
        notificationId: "notification-1",
        channel: "EMAIL",
        status: "PENDING",
      },
      select: { id: true },
    })
    expect(prismaMock.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: "Brevo respondeu 500",
        sentAt: null,
      },
    })
  })

  it("não cria delivery quando o usuário não tem push nem e-mail", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: null,
      pushSubscriptions: [],
    })

    const result = await notify(INPUT)

    expect(result).toEqual({
      skipped: false,
      notificationId: "notification-1",
      channels: [],
    })
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificationDelivery.create).not.toHaveBeenCalled()
    expect(prismaMock.notificationDelivery.update).not.toHaveBeenCalled()
  })
})
