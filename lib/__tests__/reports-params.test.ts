import { describe, expect, it } from "@jest/globals"

import {
  appendDateRangeParams,
  defaultReportDateInputs,
  occupationHeatLevel,
  buildPaginationRange,
  paginateList,
  productivityCompletionRate,
  summarizeProductivity,
  toIsoEndOfDay,
  toIsoStartOfDay,
  validateReportDateRange,
} from "@/lib/reports"

describe("report date params", () => {
  it("converte início e fim do dia para ISO", () => {
    const start = toIsoStartOfDay("2026-05-01")
    const end = toIsoEndOfDay("2026-05-01")

    expect(new Date(start).getHours()).toBe(0)
    expect(new Date(end).getHours()).toBe(23)
  })

  it("monta query string de período", () => {
    const params = new URLSearchParams()
    appendDateRangeParams(params, { inicio: "2026-05-01", fim: "2026-05-15" })

    expect(params.get("inicio")).toBeTruthy()
    expect(params.get("fim")).toBeTruthy()
  })

  it("fornece intervalo padrão do mês corrente", () => {
    const range = defaultReportDateInputs()
    expect(range.inicio <= range.fim).toBe(true)
  })

  it("rejeita intervalo sem datas", () => {
    expect(validateReportDateRange({ inicio: "", fim: "2026-05-01" })).toBeTruthy()
    expect(validateReportDateRange({ inicio: "2026-05-01", fim: "" })).toBeTruthy()
  })

  it("rejeita data inicial após a final", () => {
    expect(
      validateReportDateRange({ inicio: "2026-05-20", fim: "2026-05-01" })
    ).toMatch(/anterior ou igual/)
  })

  it("aceita intervalo válido", () => {
    expect(
      validateReportDateRange({ inicio: "2026-05-01", fim: "2026-05-20" })
    ).toBeNull()
  })
})

describe("occupationHeatLevel", () => {
  it("escala cores por volume", () => {
    expect(occupationHeatLevel(0)).toContain("slate")
    expect(occupationHeatLevel(4)).toContain("blue-300")
  })
})

describe("productivityCompletionRate", () => {
  it("ignora canceladas no cálculo", () => {
    expect(
      productivityCompletionRate({
        tecnico: "Ana",
        equipe: "A",
        total: 10,
        pendentes: 2,
        emAndamento: 1,
        concluidas: 6,
        canceladas: 1,
        taxaConclusao: 60,
        horasPrevistas: "08:00h",
      })
    ).toBe(67)
  })
})

describe("buildPaginationRange", () => {
  it("lista todas as páginas quando são poucas", () => {
    expect(buildPaginationRange(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("insere reticências em listas longas", () => {
    expect(buildPaginationRange(5, 12)).toContain("ellipsis")
    expect(buildPaginationRange(5, 12)[0]).toBe(1)
    expect(buildPaginationRange(5, 12).at(-1)).toBe(12)
  })
})

describe("paginateList", () => {
  it("fatia lista e calcula intervalo", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1)
    const page1 = paginateList(items, 1, 10)
    expect(page1.items).toHaveLength(10)
    expect(page1.rangeStart).toBe(1)
    expect(page1.rangeEnd).toBe(10)
    expect(page1.totalPages).toBe(3)

    const page3 = paginateList(items, 3, 10)
    expect(page3.items).toHaveLength(5)
    expect(page3.rangeEnd).toBe(25)
  })
})

describe("summarizeProductivity", () => {
  it("agrega totais da equipe", () => {
    const summary = summarizeProductivity([
      {
        tecnico: "Ana",
        equipe: "A",
        total: 4,
        pendentes: 1,
        emAndamento: 1,
        concluidas: 2,
        canceladas: 0,
        taxaConclusao: 50,
        horasPrevistas: "04:00h",
      },
    ])
    expect(summary.tecnicos).toBe(1)
    expect(summary.total).toBe(4)
    expect(summary.emAberto).toBe(2)
  })
})
