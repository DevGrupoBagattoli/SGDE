import { describe, expect, it } from "@jest/globals"

import {
  formatAuditAction,
  formatAuditField,
  formatAuditRole,
  formatAuditValue,
} from "@/lib/audit-labels"

describe("audit-labels", () => {
  it("traduz perfil do ator", () => {
    expect(formatAuditRole("gestor")).toBe("Gestor")
    expect(formatAuditRole("eletricista")).toBe("Eletricista")
  })

  it("traduz ações do banco", () => {
    expect(formatAuditAction("UPDATE_STATUS")).toBe("Alteração de status")
    expect(formatAuditAction("CREATE")).toBe("Criação")
  })

  it("traduz campos alterados", () => {
    expect(formatAuditField("inicioPrevisto")).toBe("Início previsto")
    expect(formatAuditField("participantes")).toBe("Participantes")
  })

  it("traduz status Prisma em valores De/para", () => {
    expect(formatAuditValue("status", "PENDING")).toBe("Pendente")
    expect(formatAuditValue("status", "IN_PROGRESS")).toBe("Em Andamento")
    expect(formatAuditValue("status", "DONE")).toBe("Concluído")
    expect(formatAuditValue("status", "CANCELLED")).toBe("Cancelado")
  })

  it("formata datas ISO em horários previstos", () => {
    const formatted = formatAuditValue(
      "inicioPrevisto",
      "2026-05-15T14:30:00.000Z"
    )
    expect(formatted).toMatch(/15/)
    expect(formatted).toMatch(/05/)
    expect(formatted).toMatch(/2026/)
  })
})
