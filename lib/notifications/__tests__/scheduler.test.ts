import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { DemandStatus } from "@prisma/client"

import { notify } from "@/lib/notifications/dispatcher"
import { dispatchPendingNotifications } from "@/lib/notifications/scheduler"
import { prisma } from "@/lib/server/prisma"

// As factories não podem referenciar variáveis externas (hoisting do jest.mock):
// cada mock nasce dentro da factory e é tipado depois via cast.
jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    demand: {
      findMany: jest.fn(),
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

type SchedulerDemand = {
  id: string
  status: DemandStatus
  deletedAt: Date | null
  inicioPrevisto: Date
  fimPrevisto: Date
  local: string
  descricao: string
  technician: { id: string }
  participants: Array<{ user: { id: string } }>
}

type FreshDemand = {
  id: string
  status: DemandStatus
  deletedAt: Date | null
}

type PrismaMock = {
  demand: {
    findMany: AsyncMock<SchedulerDemand[]>
    findUnique: AsyncMock<FreshDemand | null>
  }
}

const prismaMock = prisma as unknown as PrismaMock
const notifyMock = jest.mocked(notify)

// Instante fixo: testes determinísticos, sem depender do relógio real.
const NOW = new Date("2026-10-24T12:00:00.000Z")

const inMinutes = (minutes: number): Date =>
  new Date(NOW.getTime() + minutes * 60_000)

const buildDemand = (
  overrides: Partial<SchedulerDemand> = {}
): SchedulerDemand => ({
  id: "demand-1",
  status: DemandStatus.PENDING,
  deletedAt: null,
  inicioPrevisto: inMinutes(10),
  fimPrevisto: inMinutes(60),
  local: "Subestação X",
  descricao: "Manutenção preventiva",
  technician: { id: "user-1" },
  participants: [],
  ...overrides,
})

const buildFresh = (overrides: Partial<FreshDemand> = {}): FreshDemand => ({
  id: "demand-1",
  status: DemandStatus.PENDING,
  deletedAt: null,
  ...overrides,
})

const originalWindowMinutes = process.env.NOTIFY_UPCOMING_MINUTES

beforeEach(() => {
  process.env.NOTIFY_UPCOMING_MINUTES = "15"
  jest.resetAllMocks()

  prismaMock.demand.findMany.mockResolvedValue([])
  prismaMock.demand.findUnique.mockResolvedValue(buildFresh())
  notifyMock.mockResolvedValue({
    skipped: false,
    notificationId: "notification-1",
    channels: [],
  })
})

afterAll(() => {
  if (originalWindowMinutes === undefined) {
    delete process.env.NOTIFY_UPCOMING_MINUTES
  } else {
    process.env.NOTIFY_UPCOMING_MINUTES = originalWindowMinutes
  }
})

describe("dispatchPendingNotifications — anti-corrida e cancelamento", () => {
  it("não envia nada quando a demanda virou DONE na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ status: DemandStatus.DONE })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 })
  })

  it("não envia nada quando a demanda virou CANCELLED na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ status: DemandStatus.CANCELLED })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 })
  })

  it("não envia nada quando a demanda foi deletada na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ deletedAt: new Date("2026-10-24T12:00:01.000Z") })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 })
  })

  it("não envia nada quando a demanda não existe mais", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(null)

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 })
  })
})

describe("dispatchPendingNotifications — envio", () => {
  it("notifica SERVICE_UPCOMING para o técnico dentro da janela", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith({
      userId: "user-1",
      type: "SERVICE_UPCOMING",
      priority: "NORMAL",
      demandId: "demand-1",
      content: {
        title: "Serviço começa em instantes",
        body: "Subestação X — Manutenção preventiva (início previsto às 09:10)",
        url: "/dashboard",
        tag: "SERVICE_UPCOMING:demand-1",
      },
      dedupeKey: "SERVICE_UPCOMING:demand-1:user-1",
    })
    expect(result).toEqual({ dispatched: 1, skipped: 0, failed: 0 })
  })

  it("notifica SERVICE_FINISH_REMINDER quando o fim previsto já venceu", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({
        inicioPrevisto: inMinutes(-30),
        fimPrevisto: inMinutes(-5),
      }),
    ])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "SERVICE_FINISH_REMINDER",
        demandId: "demand-1",
        dedupeKey: "SERVICE_FINISH_REMINDER:demand-1:user-1",
      })
    )
    expect(result).toEqual({ dispatched: 1, skipped: 0, failed: 0 })
  })

  it("notifica técnico e participante (um notify por destinatário)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({ participants: [{ user: { id: "user-2" } }] }),
    ])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(notifyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-1",
        dedupeKey: "SERVICE_UPCOMING:demand-1:user-1",
      })
    )
    expect(notifyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: "user-2",
        dedupeKey: "SERVICE_UPCOMING:demand-1:user-2",
      })
    )
    expect(result).toEqual({ dispatched: 2, skipped: 0, failed: 0 })
  })

  it("conta skipped quando o dispatcher retorna skipped (idempotência)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    notifyMock.mockResolvedValue({
      skipped: true,
      notificationId: "notification-existente",
      channels: [],
    })

    const result = await dispatchPendingNotifications(NOW)

    expect(result).toEqual({ dispatched: 0, skipped: 1, failed: 0 })
  })

  it("conta failed e continua a varredura quando o notify lança", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({ id: "demand-1", technician: { id: "user-1" } }),
      buildDemand({ id: "demand-2", technician: { id: "user-2" } }),
    ])
    prismaMock.demand.findUnique
      .mockResolvedValueOnce(buildFresh({ id: "demand-1" }))
      .mockResolvedValueOnce(buildFresh({ id: "demand-2" }))
    notifyMock
      .mockRejectedValueOnce(new Error("falha inesperada no dispatcher"))
      .mockResolvedValueOnce({
        skipped: false,
        notificationId: "notification-2",
        channels: [],
      })

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ dispatched: 1, skipped: 0, failed: 1 })
  })
})
