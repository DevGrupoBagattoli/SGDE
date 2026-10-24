import { describe, expect, it } from "@jest/globals"

import { buildNotificationContent } from "@/lib/notifications/content"

// 2026-10-24T11:00:00Z equivale a 08:00 em America/Sao_Paulo (UTC-3),
// fuso fixo usado pelo formatador de horário do módulo.
const DEMAND = {
  id: "demand-1",
  descricao: "Manutenção preventiva",
  local: "Subestação X",
  inicioPrevisto: new Date("2026-10-24T11:00:00.000Z"),
}

describe("buildNotificationContent — SERVICE_UPCOMING", () => {
  it("monta título, corpo, tag e url do lembrete de início", () => {
    const content = buildNotificationContent("SERVICE_UPCOMING", DEMAND)

    expect(content.title).toBe("Serviço começa em instantes")
    expect(content.body).toContain(DEMAND.local)
    expect(content.body).toContain(DEMAND.descricao)
    expect(content.tag).toBe("SERVICE_UPCOMING:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("formata o início previsto no fuso do Brasil", () => {
    const content = buildNotificationContent("SERVICE_UPCOMING", DEMAND)

    expect(content.body).toBe(
      "Subestação X — Manutenção preventiva (início previsto às 08:00)"
    )
  })
})

describe("buildNotificationContent — SERVICE_FINISH_REMINDER", () => {
  it("monta título, corpo, tag e url do lembrete de finalização", () => {
    const content = buildNotificationContent("SERVICE_FINISH_REMINDER", DEMAND)

    expect(content.title).toBe("Serviço pendente de finalização")
    expect(content.body).toContain(DEMAND.descricao)
    expect(content.tag).toBe("SERVICE_FINISH_REMINDER:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("inclui a instrução de finalizar no sistema", () => {
    const content = buildNotificationContent("SERVICE_FINISH_REMINDER", DEMAND)

    expect(content.body).toBe(
      '"Manutenção preventiva" passou do horário de fim previsto. Finalize no sistema.'
    )
  })
})
