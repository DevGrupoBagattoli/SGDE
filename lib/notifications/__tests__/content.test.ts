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

const CONTEXT = {
  actorName: "Maria",
  statusLabel: "Em Andamento",
  userName: "João",
  technicianName: "João",
  unseenHours: 2,
}

describe("buildNotificationContent — eventos de demanda", () => {
  it("DEMAND_CREATED: título, corpo, tag e url", () => {
    const content = buildNotificationContent("DEMAND_CREATED", DEMAND)

    expect(content.title).toBe("Novo chamado atribuído a você")
    expect(content.body).toBe(
      "Subestação X — Manutenção preventiva (início previsto às 08:00). Confira a duração prevista."
    )
    expect(content.tag).toBe("DEMAND_CREATED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_SCHEDULE_CHANGED: título, corpo, tag e url", () => {
    const content = buildNotificationContent(
      "DEMAND_SCHEDULE_CHANGED",
      DEMAND,
      CONTEXT
    )

    expect(content.title).toBe("Horário do chamado alterado")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X): horário alterado por Maria. Confira o novo horário.'
    )
    expect(content.tag).toBe("DEMAND_SCHEDULE_CHANGED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_STATUS_CHANGED: contém statusLabel e actorName", () => {
    const content = buildNotificationContent(
      "DEMAND_STATUS_CHANGED",
      DEMAND,
      CONTEXT
    )

    expect(content.title).toBe("Status do chamado alterado")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X): novo status Em Andamento (alterado por Maria).'
    )
    expect(content.tag).toBe("DEMAND_STATUS_CHANGED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_CANCELLED: título, corpo, tag e url", () => {
    const content = buildNotificationContent("DEMAND_CANCELLED", DEMAND, CONTEXT)

    expect(content.title).toBe("Chamado cancelado")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X) foi cancelado por Maria.'
    )
    expect(content.tag).toBe("DEMAND_CANCELLED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_DESCRIPTION_CHANGED: título, corpo, tag e url", () => {
    const content = buildNotificationContent(
      "DEMAND_DESCRIPTION_CHANGED",
      DEMAND,
      CONTEXT
    )

    expect(content.title).toBe("Descrição do chamado alterada")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X): descrição alterada por Maria.'
    )
    expect(content.tag).toBe("DEMAND_DESCRIPTION_CHANGED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_DELETED: título, corpo, tag e url", () => {
    const content = buildNotificationContent("DEMAND_DELETED", DEMAND, CONTEXT)

    expect(content.title).toBe("Chamado excluído")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X) foi excluído por Maria.'
    )
    expect(content.tag).toBe("DEMAND_DELETED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_ACK_CONFIRMED: contém userName", () => {
    const content = buildNotificationContent(
      "DEMAND_ACK_CONFIRMED",
      DEMAND,
      CONTEXT
    )

    expect(content.title).toBe("Chamado confirmado pelo técnico")
    expect(content.body).toBe(
      'João está ciente do chamado "Manutenção preventiva" (Subestação X).'
    )
    expect(content.tag).toBe("DEMAND_ACK_CONFIRMED:demand-1")
    expect(content.url).toBe("/dashboard")
  })

  it("DEMAND_UNSEEN_ESCALATION: contém technicianName e unseenHours", () => {
    const content = buildNotificationContent(
      "DEMAND_UNSEEN_ESCALATION",
      DEMAND,
      CONTEXT
    )

    expect(content.title).toBe("Chamado ainda não visto")
    expect(content.body).toBe(
      '"Manutenção preventiva" (Subestação X) está há 2h sem ser visto por João. Considere ligar ou enviar mensagem.'
    )
    expect(content.tag).toBe("DEMAND_UNSEEN_ESCALATION:demand-1")
    expect(content.url).toBe("/dashboard")
  })
})
