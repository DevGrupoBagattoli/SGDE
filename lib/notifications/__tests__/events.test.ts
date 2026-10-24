import { describe, expect, it } from "@jest/globals"
import { DemandStatus } from "@prisma/client"

import {
  buildDedupeKey,
  isOverdueCandidate,
  isUpcomingCandidate,
  resolveRecipients,
} from "@/lib/notifications/events"

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
