import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  notifyDemandAck,
  notifyDemandEvent,
} from "@/lib/notifications/demand-events"
import { notify } from "@/lib/notifications/dispatcher"
import { prisma } from "@/lib/server/prisma"

// As factories não podem referenciar variáveis externas (hoisting do jest.mock):
// cada mock nasce dentro da factory e é tipado depois via cast.
jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    demand: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("@/lib/notifications/dispatcher", () => ({
  notify: jest.fn(),
}))

type AsyncMock<TResult, TArgs extends unknown[] = unknown[]> = jest.Mock<
  (...args: TArgs) => Promise<TResult>
>

type DemandLookup = {
  id: string
  createdById: string
  descricao: string
  local: string
  inicioPrevisto: Date
}

type PrismaMock = {
  demand: {
    findUnique: AsyncMock<DemandLookup | null>
  }
}

const prismaMock = prisma as unknown as PrismaMock
const notifyMock = jest.mocked(notify)

const DEMAND = {
  id: "demand-1",
  version: 3,
  descricao: "Manutenção preventiva",
  local: "Subestação X",
  inicioPrevisto: new Date("2026-10-24T11:00:00.000Z"),
  technician: { id: "user-1" },
  participants: [{ user: { id: "user-2" } }, { user: { id: "user-3" } }],
}

beforeEach(() => {
  jest.resetAllMocks()

  prismaMock.demand.findUnique.mockResolvedValue(null)
  notifyMock.mockResolvedValue({
    skipped: false,
    notificationId: "notification-1",
    channels: [],
  })
})

describe("notifyDemandEvent", () => {
  it("notifica técnico + participantes menos o autor", async () => {
    await notifyDemandEvent({
      type: "DEMAND_CREATED",
      demand: DEMAND,
      actorId: "user-2",
      actorName: "Maria",
    })

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(notifyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-1",
        type: "DEMAND_CREATED",
        priority: "CRITICAL",
        demandId: "demand-1",
        dedupeKey: "DEMAND_CREATED:demand-1:user-1:v3",
      })
    )
    expect(notifyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: "user-3",
        type: "DEMAND_CREATED",
        priority: "CRITICAL",
        demandId: "demand-1",
        dedupeKey: "DEMAND_CREATED:demand-1:user-3:v3",
      })
    )
  })

  it("não notifica o autor quando ele é o técnico (só participantes)", async () => {
    await notifyDemandEvent({
      type: "DEMAND_STATUS_CHANGED",
      demand: DEMAND,
      actorId: "user-1",
      actorName: "João",
      statusLabel: "Em Andamento",
    })

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(notifyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: "user-2" })
    )
    expect(notifyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: "user-3" })
    )
  })

  it("não faz nada (sem erro) quando não há destinatários", async () => {
    await expect(
      notifyDemandEvent({
        type: "DEMAND_DELETED",
        demand: { ...DEMAND, participants: [] },
        actorId: "user-1",
        actorName: "João",
      })
    ).resolves.toBeUndefined()

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it("não aborta os demais destinatários quando o notify de um falha", async () => {
    notifyMock
      .mockRejectedValueOnce(new Error("falha no envio"))
      .mockResolvedValueOnce({
        skipped: false,
        notificationId: "notification-2",
        channels: [],
      })

    await expect(
      notifyDemandEvent({
        type: "DEMAND_CREATED",
        demand: DEMAND,
        actorId: "user-2",
        actorName: "Maria",
      })
    ).resolves.toBeUndefined()

    expect(notifyMock).toHaveBeenCalledTimes(2)
  })
})

describe("notifyDemandAck", () => {
  it("notifica o criador com a dedupeKey correta", async () => {
    prismaMock.demand.findUnique.mockResolvedValue({
      id: "demand-1",
      createdById: "manager-1",
      descricao: "Manutenção preventiva",
      local: "Subestação X",
      inicioPrevisto: new Date("2026-10-24T11:00:00.000Z"),
    })

    await notifyDemandAck({
      notificationId: "notification-1",
      demandId: "demand-1",
      ackUserId: "user-1",
      ackUserName: "João",
    })

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith({
      userId: "manager-1",
      type: "DEMAND_ACK_CONFIRMED",
      priority: "NORMAL",
      demandId: "demand-1",
      content: {
        title: "Chamado confirmado pelo técnico",
        body: 'João está ciente do chamado "Manutenção preventiva" (Subestação X).',
        url: "/dashboard",
        tag: "DEMAND_ACK_CONFIRMED:demand-1",
      },
      dedupeKey: "DEMAND_ACK_CONFIRMED:notification-1:manager-1",
    })
  })

  it("não faz nada quando o próprio criador confirma", async () => {
    prismaMock.demand.findUnique.mockResolvedValue({
      id: "demand-1",
      createdById: "manager-1",
      descricao: "Manutenção preventiva",
      local: "Subestação X",
      inicioPrevisto: new Date("2026-10-24T11:00:00.000Z"),
    })

    await notifyDemandAck({
      notificationId: "notification-1",
      demandId: "demand-1",
      ackUserId: "manager-1",
      ackUserName: "Maria",
    })

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it("não faz nada quando a demanda não existe", async () => {
    prismaMock.demand.findUnique.mockResolvedValue(null)

    await notifyDemandAck({
      notificationId: "notification-1",
      demandId: "demand-1",
      ackUserId: "user-1",
      ackUserName: "João",
    })

    expect(notifyMock).not.toHaveBeenCalled()
  })
})
