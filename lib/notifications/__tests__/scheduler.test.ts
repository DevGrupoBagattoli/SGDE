import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { DemandStatus } from "@prisma/client"

import { notify } from "@/lib/notifications/dispatcher"
import { addHours, hourBucket } from "@/lib/notifications/events"
import { dispatchPendingNotifications } from "@/lib/notifications/scheduler"
import type { NotificationEventType } from "@/lib/notifications/types"
import { prisma } from "@/lib/server/prisma"

// As factories não podem referenciar variáveis externas (hoisting do jest.mock):
// cada mock nasce dentro da factory e é tipado depois via cast.
jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    demand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
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
  createdById: string
  technician: { id: string; name: string }
  participants: Array<{ user: { id: string } }>
}

type FreshDemand = {
  id: string
  status: DemandStatus
  deletedAt: Date | null
  inicioPrevisto: Date
  fimPrevisto: Date
}

type SchedulerNotification = {
  id: string
  demandId: string
  userId: string
  type: NotificationEventType
  readAt: Date | null
  createdAt: Date
  user: { name: string }
}

type PrismaMock = {
  demand: {
    findMany: AsyncMock<SchedulerDemand[]>
    findUnique: AsyncMock<FreshDemand | null>
  }
  notification: {
    findMany: AsyncMock<SchedulerNotification[]>
  }
}

const prismaMock = prisma as unknown as PrismaMock
const notifyMock = jest.mocked(notify)

// Instante fixo: testes determinísticos, sem depender do relógio real.
const NOW = new Date("2026-10-24T12:00:00.000Z")

const inMinutes = (minutes: number): Date =>
  new Date(NOW.getTime() + minutes * 60_000)

const inHours = (hours: number): Date =>
  new Date(NOW.getTime() + hours * 3_600_000)

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
  createdById: "manager-1",
  technician: { id: "user-1", name: "João" },
  participants: [],
  ...overrides,
})

// Espelha os defaults de buildDemand: fresh = stale, salvo quando o teste
// simula explicitamente um reagendamento entre o findMany e a re-busca.
const buildFresh = (overrides: Partial<FreshDemand> = {}): FreshDemand => ({
  id: "demand-1",
  status: DemandStatus.PENDING,
  deletedAt: null,
  inicioPrevisto: inMinutes(10),
  fimPrevisto: inMinutes(60),
  ...overrides,
})

const buildNotification = (
  overrides: Partial<SchedulerNotification> = {}
): SchedulerNotification => ({
  id: "notification-1",
  demandId: "demand-1",
  userId: "user-1",
  type: "DEMAND_CREATED",
  readAt: null,
  createdAt: inHours(-3),
  user: { name: "João" },
  ...overrides,
})

const originalWindowMinutes = process.env.NOTIFY_UPCOMING_MINUTES
const originalEscalationHours = process.env.NOTIFY_ESCALATION_HOURS
const originalFinishMaxHours = process.env.NOTIFY_FINISH_MAX_HOURS

beforeEach(() => {
  process.env.NOTIFY_UPCOMING_MINUTES = "15"
  process.env.NOTIFY_ESCALATION_HOURS = "2"
  process.env.NOTIFY_FINISH_MAX_HOURS = "24"
  jest.resetAllMocks()

  prismaMock.demand.findMany.mockResolvedValue([])
  prismaMock.demand.findUnique.mockResolvedValue(buildFresh())
  prismaMock.notification.findMany.mockResolvedValue([])
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

  if (originalEscalationHours === undefined) {
    delete process.env.NOTIFY_ESCALATION_HOURS
  } else {
    process.env.NOTIFY_ESCALATION_HOURS = originalEscalationHours
  }

  if (originalFinishMaxHours === undefined) {
    delete process.env.NOTIFY_FINISH_MAX_HOURS
  } else {
    process.env.NOTIFY_FINISH_MAX_HOURS = originalFinishMaxHours
  }
})

const EMPTY_RESULT = {
  dispatched: 0,
  skipped: 0,
  failed: 0,
  escalated: 0,
  escalatedSkipped: 0,
  escalatedFailed: 0,
}

describe("dispatchPendingNotifications — anti-corrida e cancelamento", () => {
  it("não envia nada quando a demanda virou DONE na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ status: DemandStatus.DONE })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("não envia nada quando a demanda virou CANCELLED na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ status: DemandStatus.CANCELLED })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("não envia nada quando a demanda foi deletada na re-verificação", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ deletedAt: new Date("2026-10-24T12:00:01.000Z") })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("não envia nada quando a demanda não existe mais", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(null)

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("avalia a janela de tempo na linha fresh: reagendamento não dispara lembrete com horário antigo", async () => {
    // Linha stale dentro da janela upcoming (início em +10min), mas fresh
    // reagendada para +2h (fora da janela de 15min) → nenhum SERVICE_UPCOMING.
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ inicioPrevisto: inHours(2), fimPrevisto: inHours(3) })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
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
      priority: "CRITICAL",
      demandId: "demand-1",
      content: {
        title: "Serviço começa em instantes",
        body: "Subestação X — Manutenção preventiva (início previsto às 09:10)",
        url: "/dashboard",
        tag: "SERVICE_UPCOMING:demand-1",
      },
      dedupeKey: "SERVICE_UPCOMING:demand-1:user-1",
    })
    expect(result).toEqual({ ...EMPTY_RESULT, dispatched: 1 })
  })

  it("notifica SERVICE_FINISH_REMINDER quando o fim previsto já venceu", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({
        inicioPrevisto: inMinutes(-30),
        fimPrevisto: inMinutes(-5),
      }),
    ])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ inicioPrevisto: inMinutes(-30), fimPrevisto: inMinutes(-5) })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "SERVICE_FINISH_REMINDER",
        priority: "CRITICAL",
        demandId: "demand-1",
        dedupeKey: `SERVICE_FINISH_REMINDER:demand-1:user-1:${hourBucket(NOW)}`,
      })
    )
    expect(result).toEqual({ ...EMPTY_RESULT, dispatched: 1 })
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
    expect(result).toEqual({ ...EMPTY_RESULT, dispatched: 2 })
  })

  it("conta skipped quando o dispatcher retorna skipped (idempotência)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([buildDemand()])
    notifyMock.mockResolvedValue({
      skipped: true,
      notificationId: "notification-existente",
      channels: [],
    })

    const result = await dispatchPendingNotifications(NOW)

    expect(result).toEqual({ ...EMPTY_RESULT, skipped: 1 })
  })

  it("conta failed e continua a varredura quando o notify lança", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({ id: "demand-1", technician: { id: "user-1", name: "João" } }),
      buildDemand({ id: "demand-2", technician: { id: "user-2", name: "Carlos" } }),
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
    expect(result).toEqual({ ...EMPTY_RESULT, dispatched: 1, failed: 1 })
  })
})

describe("dispatchPendingNotifications — lembrete recorrente", () => {
  // fresh espelha a demanda vencida usada nos cenários deste bloco.
  beforeEach(() => {
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ inicioPrevisto: inMinutes(-30), fimPrevisto: inMinutes(-5) })
    )
  })

  it("usa o bucket de hora no dedupeKey do lembrete de finalização", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({
        inicioPrevisto: inMinutes(-30),
        fimPrevisto: inMinutes(-5),
      }),
    ])

    await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SERVICE_FINISH_REMINDER",
        priority: "CRITICAL",
        dedupeKey: `SERVICE_FINISH_REMINDER:demand-1:user-1:${hourBucket(NOW)}`,
      })
    )
  })

  it("re-dispara na hora seguinte com bucket diferente", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({
        inicioPrevisto: inMinutes(-30),
        fimPrevisto: inMinutes(-5),
      }),
    ])

    await dispatchPendingNotifications(addHours(NOW, 1))

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: `SERVICE_FINISH_REMINDER:demand-1:user-1:${hourBucket(NOW) + 1}`,
      })
    )
  })

  it("conta skipped quando o lembrete da mesma hora já foi enviado", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({
        inicioPrevisto: inMinutes(-30),
        fimPrevisto: inMinutes(-5),
      }),
    ])
    notifyMock.mockResolvedValue({
      skipped: true,
      notificationId: "notification-existente",
      channels: [],
    })

    const result = await dispatchPendingNotifications(NOW)

    expect(result).toEqual({ ...EMPTY_RESULT, skipped: 1 })
  })

  it("não notifica demanda vencida além do teto (NOTIFY_FINISH_MAX_HOURS)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      buildDemand({ inicioPrevisto: inHours(-31), fimPrevisto: inHours(-30) }),
    ])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ inicioPrevisto: inHours(-31), fimPrevisto: inHours(-30) })
    )

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })
})

describe("dispatchPendingNotifications — escalonamento de não-lidas", () => {
  const activeDemand = (
    overrides: Partial<SchedulerDemand> = {}
  ): SchedulerDemand =>
    buildDemand({
      inicioPrevisto: inMinutes(60),
      fimPrevisto: inMinutes(120),
      ...overrides,
    })

  // Demanda ativa fora de qualquer janela: o loop principal não notifica e o
  // teste isola o escalonamento.
  beforeEach(() => {
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ inicioPrevisto: inMinutes(60), fimPrevisto: inMinutes(120) })
    )
  })

  it("escalona para o criador quando a notificação está não lida há ≥ 2h", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([buildNotification()])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith({
      userId: "manager-1",
      type: "DEMAND_UNSEEN_ESCALATION",
      priority: "CRITICAL",
      demandId: "demand-1",
      content: {
        title: "Chamado ainda não visto",
        body: '"Manutenção preventiva" (Subestação X) está há 3h sem ser visto por João. Considere ligar ou enviar mensagem.',
        url: "/dashboard",
        tag: "DEMAND_UNSEEN_ESCALATION:demand-1",
      },
      dedupeKey: "DEMAND_UNSEEN_ESCALATION:notification-1:manager-1",
    })
    expect(result).toEqual({ ...EMPTY_RESULT, escalated: 1 })
  })

  it("não escalona quando a notificação é recente (< 2h)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([
      buildNotification({ createdAt: inHours(-1) }),
    ])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("não escalona quando a notificação já foi lida", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([
      buildNotification({ readAt: inHours(-1) }),
    ])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("não escalona quando a demanda está DONE", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      activeDemand({ status: DemandStatus.DONE }),
    ])
    prismaMock.demand.findUnique.mockResolvedValue(
      buildFresh({ status: DemandStatus.DONE })
    )
    prismaMock.notification.findMany.mockResolvedValue([buildNotification()])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("conta escalatedSkipped quando o escalonamento já existe (dedupe)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([buildNotification()])
    notifyMock.mockResolvedValue({
      skipped: true,
      notificationId: "notification-existente",
      channels: [],
    })

    const result = await dispatchPendingNotifications(NOW)

    expect(result).toEqual({ ...EMPTY_RESULT, escalatedSkipped: 1 })
  })

  it("não escalona quando o destinatário é o próprio criador", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([
      buildNotification({ userId: "manager-1" }),
    ])

    const result = await dispatchPendingNotifications(NOW)

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual(EMPTY_RESULT)
  })

  it("conta escalatedFailed quando o notify do escalonamento lança", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([buildNotification()])
    notifyMock.mockRejectedValueOnce(new Error("falha no escalonamento"))

    const result = await dispatchPendingNotifications(NOW)

    expect(result).toEqual({ ...EMPTY_RESULT, escalatedFailed: 1 })
  })

  it("nomeia o destinatário que não leu (participante), não o técnico", async () => {
    prismaMock.demand.findMany.mockResolvedValue([activeDemand()])
    prismaMock.notification.findMany.mockResolvedValue([
      buildNotification({ userId: "user-2", user: { name: "Carlos" } }),
    ])

    await dispatchPendingNotifications(NOW)

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: expect.stringContaining("sem ser visto por Carlos"),
        }),
      })
    )
  })

  it("consulta notificações uma única vez (sem N+1)", async () => {
    prismaMock.demand.findMany.mockResolvedValue([
      activeDemand(),
      activeDemand({ id: "demand-2" }),
    ])
    prismaMock.notification.findMany.mockResolvedValue([
      buildNotification(),
      buildNotification({ id: "notification-2", demandId: "demand-2" }),
    ])

    await dispatchPendingNotifications(NOW)

    expect(prismaMock.notification.findMany).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledTimes(2)
  })
})
