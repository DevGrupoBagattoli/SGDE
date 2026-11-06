import { describe, expect, it } from "@jest/globals"

import { parseCreateDemandData } from "@/lib/server/demands"

describe("parseCreateDemandData (agendamento)", () => {
  it("calcula fim a partir de início e duração HH:MMh", () => {
    const parsed = parseCreateDemandData({
      tecnico: "João Silva",
      equipe: "Alpha",
      local: "Condomínio Solar",
      descricao: "Troca de disjuntor",
      horarioInicio: "2026-05-11T14:00:00.000Z",
      duracaoPrevista: "01:30h",
      status: "Pendente",
      observacoes: "",
      participantes: [],
    })

    expect(parsed.durationMinutes).toBe(90)
    expect(parsed.start.toISOString()).toBe("2026-05-11T14:00:00.000Z")
    expect(parsed.end.toISOString()).toBe("2026-05-11T15:30:00.000Z")
  })

  it("lança se intervalo for inválido", () => {
    expect(() =>
      parseCreateDemandData({
        tecnico: "João Silva",
        equipe: "Alpha",
        local: "Condomínio Solar",
        descricao: "Troca de disjuntor",
        horarioInicio: "2026-05-11T14:00:00.000Z",
        duracaoPrevista: "00:00h",
        status: "Pendente",
        observacoes: "",
        participantes: [],
      })
    ).toThrow("Intervalo inválido")
  })
})
