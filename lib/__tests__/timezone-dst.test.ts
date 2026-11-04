import { afterAll, describe, expect, it, jest } from "@jest/globals"

// Fuso com horário de verão que começa à meia-noite (relógio pula 24:00 -> 01:00).
// Em 2026-09-06 America/Santiago passa de -04 para -03 às 04:00Z.
describe("zonedWallTimeToDate em fuso com horário de verão", () => {
  const load = async () => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_APP_TIMEZONE = "America/Santiago"
    return import("@/lib/timezone")
  }

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_APP_TIMEZONE
    jest.resetModules()
  })

  it("início do dia do salto fica no próprio dia (01:00), não no anterior", async () => {
    const tz = await load()
    const start = tz.startOfDayInAppTz("2026-09-06")
    expect(start.toISOString()).toBe("2026-09-06T04:00:00.000Z")
    expect(tz.dateKeyInAppTz(start)).toBe("2026-09-06")
  })

  it("hora inexistente digitada avança para depois do salto", async () => {
    const tz = await load()
    expect(tz.fromAppDateTimeInputValue("2026-09-06T00:30")).toBe("2026-09-06T04:30:00.000Z")
  })

  it("horas normais continuam exatas", async () => {
    const tz = await load()
    expect(tz.fromAppDateTimeInputValue("2026-09-06T08:00")).toBe("2026-09-06T11:00:00.000Z")
    expect(tz.fromAppDateTimeInputValue("2026-09-05T08:00")).toBe("2026-09-05T12:00:00.000Z")
  })
})
