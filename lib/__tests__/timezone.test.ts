import { describe, expect, it } from "@jest/globals"

import {
  APP_TIME_ZONE,
  appTimeFormatter,
  dateKeyInAppTz,
  endOfDayInAppTz,
  enumerateDateKeysInAppTz,
  formatAppDateTime,
  formatAppDateTimeRange,
  startOfDayInAppTz,
  todayCalendarDateInAppTz,
  zonedWallTimeToDate,
} from "@/lib/timezone"
import { formatAuditValue } from "@/lib/audit-labels"

describe("fuso da empresa", () => {
  it("padrão é America/Porto_Velho (Vilhena/RO)", () => {
    expect(APP_TIME_ZONE).toBe("America/Porto_Velho")
  })

  it("formata horário no fuso da empresa, independente do fuso do processo", () => {
    expect(appTimeFormatter.format(new Date("2026-11-04T12:00:00.000Z"))).toBe("08:00")
    expect(formatAppDateTime(new Date("2026-11-04T12:00:00.000Z"))).toBe("04/11/2026 08:00")
  })

  it("formata intervalo no fuso da empresa, com uma ou duas datas", () => {
    expect(
      formatAppDateTimeRange(new Date("2026-05-11T14:00:00.000Z"), new Date("2026-05-11T16:00:00.000Z"))
    ).toBe("11/05/2026 10:00 – 12:00")
    // 23:00 local de um dia até 01:00 do seguinte
    expect(
      formatAppDateTimeRange(new Date("2026-05-12T03:00:00.000Z"), new Date("2026-05-12T05:00:00.000Z"))
    ).toBe("11/05/2026 23:00 – 12/05/2026 01:00")
  })

  it("converte data/hora de parede em instante", () => {
    expect(zonedWallTimeToDate(2026, 11, 4, 8, 0).toISOString()).toBe(
      "2026-11-04T12:00:00.000Z"
    )
  })

  it("dia civil considera o fuso da empresa", () => {
    expect(dateKeyInAppTz(new Date("2026-11-05T03:59:00.000Z"))).toBe("2026-11-04")
    expect(dateKeyInAppTz(new Date("2026-11-05T04:00:00.000Z"))).toBe("2026-11-05")
  })

  it("início e fim do dia", () => {
    expect(startOfDayInAppTz("2026-11-04").toISOString()).toBe("2026-11-04T04:00:00.000Z")
    expect(endOfDayInAppTz("2026-11-30").toISOString()).toBe("2026-12-01T03:59:59.999Z")
  })

  it("período de 01 a 30/11 não ganha a coluna 01/12", () => {
    const keys = enumerateDateKeysInAppTz(
      startOfDayInAppTz("2026-11-01"),
      endOfDayInAppTz("2026-11-30")
    )
    expect(keys).toHaveLength(30)
    expect(keys[0]).toBe("2026-11-01")
    expect(keys[keys.length - 1]).toBe("2026-11-30")
  })

  it("enumera atravessando virada de mês e ano", () => {
    expect(
      enumerateDateKeysInAppTz(
        new Date("2026-12-31T22:00:00.000Z"),
        new Date("2027-01-02T12:00:00.000Z")
      )
    ).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"])
  })

  it("'hoje' segue o dia da empresa", () => {
    const today = todayCalendarDateInAppTz(new Date("2026-11-05T02:00:00.000Z"))
    expect([today.getFullYear(), today.getMonth() + 1, today.getDate()]).toEqual([2026, 11, 4])
  })

  it("auditoria formata horários no fuso da empresa", () => {
    expect(formatAuditValue("inicioPrevisto", "2026-11-04T12:00:00.000Z")).toBe(
      "04/11/2026 08:00"
    )
  })
})
