import { describe, expect, it } from "@jest/globals"
import { DemandStatus } from "@prisma/client"

import {
  buildDedupeKey,
  buildDemandEventDedupeKey,
  buildRecurringDedupeKey,
  excludeActor,
  hourBucket,
  isEscalationCandidate,
  isOverdueCandidate,
  isUpcomingCandidate,
  resolvePriority,
  resolveRecipients,
} from "@/lib/notifications/events"
import type { NotificationEventType } from "@/lib/notifications/types"

// Instante fixo: testes determinísticos, sem depender do relógio real.
const NOW = new Date("2026-10-24T12:00:00.000Z")

const addMinutes = (minutes: number): Date =>
  new Date(NOW.getTime() + minutes * 60_000)

type UpcomingDemand = {
  status: DemandStatus
  deletedAt: Date | null
  inicioPrevisto: Date
}

const upcomingDemand = (
  overrides: Partial<UpcomingDemand> = {}
): UpcomingDemand => ({
  status: DemandStatus.PENDING,
  deletedAt: null,
  inicioPrevisto: addMinutes(10),
  ...overrides,
})

type OverdueDemand = {
  status: DemandStatus
  deletedAt: Date | null
  fimPrevisto: Date
}

const overdueDemand = (overrides: Partial<OverdueDemand> = {}): OverdueDemand => ({
  status: DemandStatus.PENDING,
  deletedAt: null,
  fimPrevisto: addMinutes(-5),
  ...overrides,
})

describe("isUpcomingCandidate", () => {
  it("aceita demanda PENDING dentro da janela (now + 10min)", () => {
    expect(isUpcomingCandidate(upcomingDemand(), NOW, 15)).toBe(true)
  })

  it("aceita demanda IN_PROGRESS dentro da janela", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ status: DemandStatus.IN_PROGRESS }),
        NOW,
        15
      )
    ).toBe(true)
  })

  it("rejeita início exatamente em now (a janela abre somente depois de now)", () => {
    expect(
      isUpcomingCandidate(upcomingDemand({ inicioPrevisto: NOW }), NOW, 15)
    ).toBe(false)
  })

  it("aceita o limite exato da janela (now + 15min)", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ inicioPrevisto: addMinutes(15) }),
        NOW,
        15
      )
    ).toBe(true)
  })

  it("rejeita início além da janela (now + 16min)", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ inicioPrevisto: addMinutes(16) }),
        NOW,
        15
      )
    ).toBe(false)
  })

  it("rejeita início já passado", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ inicioPrevisto: addMinutes(-1) }),
        NOW,
        15
      )
    ).toBe(false)
  })

  it("rejeita demanda DONE", () => {
    expect(
      isUpcomingCandidate(upcomingDemand({ status: DemandStatus.DONE }), NOW, 15)
    ).toBe(false)
  })

  it("rejeita demanda CANCELLED", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ status: DemandStatus.CANCELLED }),
        NOW,
        15
      )
    ).toBe(false)
  })

  it("rejeita demanda deletada", () => {
    expect(
      isUpcomingCandidate(
        upcomingDemand({ deletedAt: new Date("2026-10-24T11:00:00.000Z") }),
        NOW,
        15
      )
    ).toBe(false)
  })
})

describe("isOverdueCandidate", () => {
  it("aceita fim previsto já passado", () => {
    expect(isOverdueCandidate(overdueDemand(), NOW)).toBe(true)
  })

  it("aceita demanda IN_PROGRESS com fim previsto passado", () => {
    expect(
      isOverdueCandidate(
        overdueDemand({ status: DemandStatus.IN_PROGRESS }),
        NOW
      )
    ).toBe(true)
  })

  it("rejeita fim previsto no futuro", () => {
    expect(
      isOverdueCandidate(overdueDemand({ fimPrevisto: addMinutes(1) }), NOW)
    ).toBe(false)
  })

  it("rejeita fim previsto exatamente em now", () => {
    expect(isOverdueCandidate(overdueDemand({ fimPrevisto: NOW }), NOW)).toBe(
      false
    )
  })

  it("rejeita demanda DONE", () => {
    expect(
      isOverdueCandidate(overdueDemand({ status: DemandStatus.DONE }), NOW)
    ).toBe(false)
  })

  it("rejeita demanda CANCELLED", () => {
    expect(
      isOverdueCandidate(overdueDemand({ status: DemandStatus.CANCELLED }), NOW)
    ).toBe(false)
  })

  it("rejeita demanda deletada", () => {
    expect(
      isOverdueCandidate(
        overdueDemand({ deletedAt: new Date("2026-10-24T11:00:00.000Z") }),
        NOW
      )
    ).toBe(false)
  })
})

describe("isOverdueCandidate — teto (maxHours)", () => {
  it("aceita vencida há 2h com teto de 24h", () => {
    expect(
      isOverdueCandidate(overdueDemand({ fimPrevisto: addMinutes(-120) }), NOW, 24)
    ).toBe(true)
  })

  it("rejeita vencida há 30h com teto de 24h", () => {
    expect(
      isOverdueCandidate(overdueDemand({ fimPrevisto: addMinutes(-1800) }), NOW, 24)
    ).toBe(false)
  })

  it("sem teto continua aceitando vencida há 30h (retrocompatível)", () => {
    expect(
      isOverdueCandidate(overdueDemand({ fimPrevisto: addMinutes(-1800) }), NOW)
    ).toBe(true)
  })
})

describe("buildDedupeKey", () => {
  it("monta a chave no formato `${type}:${demandId}:${userId}`", () => {
    expect(buildDedupeKey("SERVICE_UPCOMING", "demand-1", "user-1")).toBe(
      "SERVICE_UPCOMING:demand-1:user-1"
    )
  })

  it("usa o tipo do evento como prefixo da chave", () => {
    expect(
      buildDedupeKey("SERVICE_FINISH_REMINDER", "demand-2", "user-3")
    ).toBe("SERVICE_FINISH_REMINDER:demand-2:user-3")
  })
})

describe("resolveRecipients", () => {
  it("não duplica quando o técnico também é participante", () => {
    const recipients = resolveRecipients({
      technician: { id: "user-1" },
      participants: [{ user: { id: "user-1" } }],
    })

    expect(recipients).toEqual([{ id: "user-1" }])
  })

  it("preserva o técnico primeiro e remove participantes repetidos", () => {
    const recipients = resolveRecipients({
      technician: { id: "user-1" },
      participants: [{ user: { id: "user-2" } }, { user: { id: "user-2" } }],
    })

    expect(recipients).toEqual([{ id: "user-1" }, { id: "user-2" }])
  })

  it("retorna somente o técnico quando não há participantes", () => {
    expect(
      resolveRecipients({ technician: { id: "user-1" }, participants: [] })
    ).toEqual([{ id: "user-1" }])
  })
})

describe("excludeActor", () => {
  it("remove o autor da lista de destinatários", () => {
    expect(
      excludeActor([{ id: "user-1" }, { id: "user-2" }], "user-1")
    ).toEqual([{ id: "user-2" }])
  })

  it("mantém os demais destinatários", () => {
    expect(
      excludeActor(
        [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }],
        "user-2"
      )
    ).toEqual([{ id: "user-1" }, { id: "user-3" }])
  })

  it("mantém a lista intacta quando o autor não está nela", () => {
    expect(excludeActor([{ id: "user-1" }], "user-9")).toEqual([
      { id: "user-1" },
    ])
  })
})

describe("hourBucket", () => {
  it("retorna o mesmo bucket para o mesmo instante", () => {
    expect(hourBucket(new Date("2026-10-24T12:00:00.000Z"))).toBe(
      hourBucket(new Date("2026-10-24T12:00:00.000Z"))
    )
  })

  it("retorna buckets diferentes para 09:59 e 10:01 (UTC)", () => {
    expect(hourBucket(new Date("2026-10-24T09:59:00.000Z"))).not.toBe(
      hourBucket(new Date("2026-10-24T10:01:00.000Z"))
    )
  })
})

describe("buildDemandEventDedupeKey", () => {
  it("monta a chave no formato `${type}:${demandId}:${userId}:v${version}`", () => {
    expect(
      buildDemandEventDedupeKey("DEMAND_CREATED", "demand-1", "user-1", 3)
    ).toBe("DEMAND_CREATED:demand-1:user-1:v3")
  })
})

describe("buildRecurringDedupeKey", () => {
  it("monta a chave no formato `${type}:${demandId}:${userId}:${bucket}`", () => {
    expect(
      buildRecurringDedupeKey(
        "SERVICE_FINISH_REMINDER",
        "demand-1",
        "user-1",
        123456
      )
    ).toBe("SERVICE_FINISH_REMINDER:demand-1:user-1:123456")
  })
})

describe("resolvePriority", () => {
  it("usa NORMAL somente para DEMAND_ACK_CONFIRMED", () => {
    expect(resolvePriority("DEMAND_ACK_CONFIRMED")).toBe("NORMAL")
  })

  it("usa CRITICAL para os demais eventos", () => {
    const criticalTypes: NotificationEventType[] = [
      "SERVICE_UPCOMING",
      "SERVICE_FINISH_REMINDER",
      "DEMAND_CREATED",
      "DEMAND_SCHEDULE_CHANGED",
      "DEMAND_STATUS_CHANGED",
      "DEMAND_CANCELLED",
      "DEMAND_DESCRIPTION_CHANGED",
      "DEMAND_DELETED",
      "DEMAND_UNSEEN_ESCALATION",
    ]

    for (const type of criticalTypes) {
      expect(resolvePriority(type)).toBe("CRITICAL")
    }
  })
})

describe("isEscalationCandidate", () => {
  type EscalationNotification = {
    type: NotificationEventType
    readAt: Date | null
    createdAt: Date
  }

  type EscalationDemand = {
    status: DemandStatus
    deletedAt: Date | null
  }

  const notification = (
    overrides: Partial<EscalationNotification> = {}
  ): EscalationNotification => ({
    type: "DEMAND_CREATED",
    readAt: null,
    createdAt: new Date("2026-10-24T09:00:00.000Z"), // 3h antes de NOW
    ...overrides,
  })

  const demand = (
    overrides: Partial<EscalationDemand> = {}
  ): EscalationDemand => ({
    status: DemandStatus.PENDING,
    deletedAt: null,
    ...overrides,
  })

  it("aceita notificação não lida, antiga e de demanda ativa", () => {
    expect(isEscalationCandidate(notification(), demand(), NOW, 2)).toBe(true)
  })

  it("rejeita notificação já lida", () => {
    expect(
      isEscalationCandidate(
        notification({ readAt: new Date("2026-10-24T10:00:00.000Z") }),
        demand(),
        NOW,
        2
      )
    ).toBe(false)
  })

  it("rejeita notificação recente (menos de thresholdHours)", () => {
    expect(
      isEscalationCandidate(
        notification({ createdAt: new Date("2026-10-24T11:30:00.000Z") }),
        demand(),
        NOW,
        2
      )
    ).toBe(false)
  })

  it("rejeita demanda DONE", () => {
    expect(
      isEscalationCandidate(
        notification(),
        demand({ status: DemandStatus.DONE }),
        NOW,
        2
      )
    ).toBe(false)
  })

  it("rejeita demanda CANCELLED", () => {
    expect(
      isEscalationCandidate(
        notification(),
        demand({ status: DemandStatus.CANCELLED }),
        NOW,
        2
      )
    ).toBe(false)
  })

  it("rejeita demanda deletada", () => {
    expect(
      isEscalationCandidate(
        notification(),
        demand({ deletedAt: new Date("2026-10-24T10:00:00.000Z") }),
        NOW,
        2
      )
    ).toBe(false)
  })

  it("rejeita tipo que não é evento de demanda (SERVICE_UPCOMING)", () => {
    expect(
      isEscalationCandidate(
        notification({ type: "SERVICE_UPCOMING" }),
        demand(),
        NOW,
        2
      )
    ).toBe(false)
  })
})
