import { describe, expect, it } from "@jest/globals"

import {
  buildCalendarDays,
  enumerateDateKeys,
  fromDateTimeLocalValue,
  getDateKey,
  toDateTimeLocalValue,
} from "@/lib/calendar"

describe("getDateKey", () => {
  it("formata ano-mês-dia no fuso local", () => {
    expect(getDateKey(new Date(2026, 4, 11))).toBe("2026-05-11")
    expect(getDateKey(new Date(2026, 0, 7))).toBe("2026-01-07")
  })
})

// Fuso da empresa: America/Porto_Velho (UTC-4).
describe("toDateTimeLocalValue / fromDateTimeLocalValue", () => {
  it("mostra o instante no relógio da empresa, não no do dispositivo", () => {
    expect(toDateTimeLocalValue("2026-05-11T19:40:00.000Z")).toBe("2026-05-11T15:40")
  })

  it("interpreta o valor digitado no fuso da empresa", () => {
    expect(fromDateTimeLocalValue("2026-05-11T15:40")).toBe("2026-05-11T19:40:00.000Z")
  })

  it("ida e volta preservam o valor", () => {
    const value = "2026-11-04T08:00"
    expect(toDateTimeLocalValue(fromDateTimeLocalValue(value))).toBe(value)
  })

  it("retorna string vazia para ISO inválido", () => {
    expect(toDateTimeLocalValue("not-a-date")).toBe("")
  })

  it("lança para valor digitado inválido", () => {
    expect(() => fromDateTimeLocalValue("")).toThrow()
  })
})

describe("enumerateDateKeys", () => {
  it("inclui cada dia civil da empresa entre início e fim", () => {
    // 22:00 do dia 10 até 06:00 do dia 11 em Vilhena
    const start = new Date("2026-05-11T02:00:00.000Z")
    const end = new Date("2026-05-11T10:00:00.000Z")
    expect(enumerateDateKeys(start, end)).toEqual(["2026-05-10", "2026-05-11"])
  })

  it("serviço às 21:00 fica no próprio dia (não no seguinte, como em UTC)", () => {
    const start = new Date("2026-11-05T01:00:00.000Z") // 04/11 21:00 em Vilhena
    const end = new Date("2026-11-05T02:00:00.000Z")
    expect(enumerateDateKeys(start, end)).toEqual(["2026-11-04"])
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
