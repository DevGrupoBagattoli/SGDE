import { describe, expect, it } from "@jest/globals"

import type { Demand } from "@/lib/demands"
import {
  formatDuracaoFromParts,
  parseDuracaoParts,
  parseDurationDisplayMinutes,
  predictedEndDate,
} from "@/lib/demands"

const baseDemand = (): Demand => ({
  id: "t1",
  tecnico: "Teste",
  equipe: "X",
  local: "L",
  descricao: "D",
  status: "Pendente",
  horarioInicio: "2026-05-11T10:00:00.000Z",
  horarioFim: "2026-05-11T12:00:00.000Z",
  duracaoPrevista: "02:00h",
  observacoes: "",
  participantes: [],
  version: 1,
  dateKeys: [],
})

describe("parseDurationDisplayMinutes", () => {
  it("aceita HH:MMh", () => {
    expect(parseDurationDisplayMinutes("02:00h")).toBe(120)
    expect(parseDurationDisplayMinutes("01:30h")).toBe(90)
    expect(parseDurationDisplayMinutes("00:15h")).toBe(15)
  })

  it("rejeita formato inválido", () => {
    expect(parseDurationDisplayMinutes("2h")).toBeNull()
    expect(parseDurationDisplayMinutes("02:00")).toBeNull()
    expect(parseDurationDisplayMinutes("")).toBeNull()
  })

  it("rejeita minutos > 59", () => {
    expect(parseDurationDisplayMinutes("01:60h")).toBeNull()
  })

  it("rejeita duração zero", () => {
    expect(parseDurationDisplayMinutes("00:00h")).toBeNull()
  })
})

describe("parseDuracaoParts / formatDuracaoFromParts", () => {
  it("interpreta string e volta ao formato da API", () => {
    expect(parseDuracaoParts("2:30")).toEqual({ hours: 2, minutes: 30 })
    expect(formatDuracaoFromParts(2, 30)).toBe("02:30h")
    expect(parseDuracaoParts("24:00h")).toEqual({ hours: 24, minutes: 0 })
    expect(formatDuracaoFromParts(24, 0)).toBe("24:00h")
  })

  it("usa 1h quando inválido ou duração zero", () => {
    expect(parseDuracaoParts("xx")).toEqual({ hours: 1, minutes: 0 })
    expect(formatDuracaoFromParts(0, 0)).toBe("01:00h")
  })
})

describe("predictedEndDate", () => {
  it("usa duração quando válida", () => {
    const d = baseDemand()
    d.horarioInicio = "2026-05-11T09:00:00.000Z"
    d.duracaoPrevista = "01:00h"
    const end = predictedEndDate(d)
    expect(end.getTime() - new Date(d.horarioInicio).getTime()).toBe(60 * 60_000)
  })

  it("usa horarioFim quando duração inválida e fim > início", () => {
    const d = baseDemand()
    d.duracaoPrevista = "invalid"
    d.horarioInicio = "2026-05-11T08:00:00.000Z"
    d.horarioFim = "2026-05-11T11:00:00.000Z"
    const end = predictedEndDate(d)
    expect(end.toISOString()).toBe("2026-05-11T11:00:00.000Z")
  })

  it("fallback 1h quando não há duração nem fim válido", () => {
    const d = baseDemand()
    d.duracaoPrevista = "xx"
    d.horarioInicio = "2026-05-11T10:00:00.000Z"
    d.horarioFim = d.horarioInicio
    const end = predictedEndDate(d)
    expect(end.getTime() - new Date(d.horarioInicio).getTime()).toBe(60 * 60_000)
  })
})
