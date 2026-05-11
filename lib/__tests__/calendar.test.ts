import { describe, expect, it } from "@jest/globals"

import {
  buildCalendarDays,
  enumerateDateKeysLocal,
  getDateKey,
  toDateTimeLocalValue,
} from "@/lib/calendar"

describe("getDateKey", () => {
  it("formata ano-mês-dia no fuso local", () => {
    expect(getDateKey(new Date(2026, 4, 11))).toBe("2026-05-11")
    expect(getDateKey(new Date(2026, 0, 7))).toBe("2026-01-07")
  })
})

describe("toDateTimeLocalValue", () => {
  it("recorta ISO para valor datetime-local", () => {
    expect(toDateTimeLocalValue("2026-05-11T14:30:00.000Z")).toBe(
      "2026-05-11T14:30"
    )
  })
})

describe("enumerateDateKeysLocal", () => {
  it("inclui cada dia civil local entre início e fim", () => {
    const start = new Date(2026, 4, 10, 22, 0, 0)
    const end = new Date(2026, 4, 11, 6, 0, 0)
    expect(enumerateDateKeysLocal(start, end)).toEqual([
      "2026-05-10",
      "2026-05-11",
    ])
  })
})

describe("buildCalendarDays", () => {
  it("retorna 42 dias começando no domingo da semana do dia 1", () => {
    const month = new Date(2026, 4, 1)
    const days = buildCalendarDays(month)

    expect(days).toHaveLength(42)
    expect(days[0].date.getDay()).toBe(0)
    expect(days.some((d) => d.dateKey === "2026-05-01" && d.isCurrentMonth)).toBe(
      true
    )
  })

  it("marca isCurrentMonth apenas para o mês pedido", () => {
    const month = new Date(2026, 4, 1)
    const days = buildCalendarDays(month)
    const mayDays = days.filter((d) => d.isCurrentMonth)

    expect(mayDays.length).toBeGreaterThanOrEqual(28)
    expect(mayDays.every((d) => d.date.getMonth() === 4)).toBe(true)
  })
})
