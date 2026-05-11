import { describe, expect, it } from "@jest/globals"

import {
  formatDurationMinutes,
  parseDurationMinutes,
} from "@/lib/server/dates"

describe("parseDurationMinutes", () => {
  it("interpreta HH:MMh", () => {
    expect(parseDurationMinutes("02:00h")).toBe(120)
    expect(parseDurationMinutes("00:45h")).toBe(45)
  })

  it("lança em formato inválido", () => {
    expect(() => parseDurationMinutes("2:00h")).toThrow()
    expect(() => parseDurationMinutes("02:00")).toThrow()
  })

  it("lança se minutos > 59", () => {
    expect(() => parseDurationMinutes("01:99h")).toThrow()
  })
})

describe("formatDurationMinutes", () => {
  it("formata com zeros à esquerda", () => {
    expect(formatDurationMinutes(65)).toBe("01:05h")
    expect(formatDurationMinutes(0)).toBe("00:00h")
  })
})
