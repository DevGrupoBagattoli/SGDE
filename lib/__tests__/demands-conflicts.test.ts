import { describe, expect, it } from "@jest/globals"

import {
  findScheduleConflicts,
  type ConflictCandidate,
} from "@/lib/demands"

const at = (hhmm: string) => new Date(`2026-05-11T${hhmm}:00.000Z`)

const joao = { userId: "u-joao", userName: "João Silva" }
const maria = { userId: "u-maria", userName: "Maria Souza" }

const candidate = (
  overrides: Partial<ConflictCandidate> = {}
): ConflictCandidate => ({
  id: "d-outro",
  local: "Bloco B",
  status: "PENDING",
  deletedAt: null,
  inicioPrevisto: at("10:00"),
  fimPrevisto: at("12:00"),
  people: [joao],
  ...overrides,
})

const find = (
  candidates: ConflictCandidate[],
  overrides: Partial<Parameters<typeof findScheduleConflicts>[0]> = {}
) =>
  findScheduleConflicts({
    start: at("11:00"),
    end: at("13:00"),
    userIds: [joao.userId],
    candidates,
    ...overrides,
  })

describe("findScheduleConflicts - sobreposição", () => {
  it("detecta sobreposição parcial", () => {
    expect(find([candidate()])).toEqual([
      {
        userId: joao.userId,
        userName: joao.userName,
        demandId: "d-outro",
        local: "Bloco B",
        inicio: at("10:00"),
        fim: at("12:00"),
      },
    ])
  })

  it("detecta chamado novo totalmente dentro do existente", () => {
    const result = find([candidate()], { start: at("10:30"), end: at("11:30") })
    expect(result).toHaveLength(1)
  })

  it("detecta chamado novo que contém o existente", () => {
    const result = find([candidate()], { start: at("09:00"), end: at("13:00") })
    expect(result).toHaveLength(1)
  })

  it("detecta intervalos idênticos", () => {
    const result = find([candidate()], { start: at("10:00"), end: at("12:00") })
    expect(result).toHaveLength(1)
  })

  it("não conflita quando o outro termina exatamente no início do novo", () => {
    expect(find([candidate()], { start: at("12:00"), end: at("13:00") })).toEqual([])
  })

  it("não conflita quando o outro começa exatamente no fim do novo", () => {
    expect(find([candidate()], { start: at("09:00"), end: at("10:00") })).toEqual([])
  })

  it("não conflita com chamados distantes", () => {
    expect(find([candidate()], { start: at("14:00"), end: at("15:00") })).toEqual([])
  })
})

describe("findScheduleConflicts - pessoas", () => {
  it("conflita só pelo participante do chamado existente", () => {
    const result = find(
      [candidate({ people: [maria, joao] })],
      { userIds: [joao.userId] }
    )
    expect(result.map((c) => c.userId)).toEqual([joao.userId])
  })

  it("conflita só pelo técnico do chamado existente", () => {
    const result = find(
      [candidate({ people: [joao, maria] })],
      { userIds: [maria.userId] }
    )
    expect(result.map((c) => c.userId)).toEqual([maria.userId])
  })

  it("lista cada pessoa ocupada quando ambas conflitam", () => {
    const result = find(
      [candidate({ people: [joao, maria] })],
      { userIds: [joao.userId, maria.userId] }
    )
    expect(result.map((c) => c.userName).sort()).toEqual([
      "João Silva",
      "Maria Souza",
    ])
  })

  it("lista a mesma pessoa uma vez por chamado em conflito", () => {
    const result = find([
      candidate({ id: "d-1", people: [joao] }),
      candidate({ id: "d-2", people: [joao], inicioPrevisto: at("12:00"), fimPrevisto: at("14:00") }),
    ])
    expect(result.map((c) => c.demandId)).toEqual(["d-1", "d-2"])
  })

  it("ignora a pessoa repetida como técnico e participante no mesmo chamado", () => {
    expect(find([candidate({ people: [joao, joao] })])).toHaveLength(1)
  })

  it("não conflita quando a pessoa não está no chamado existente", () => {
    expect(find([candidate({ people: [maria] })])).toEqual([])
  })

  it("devolve vazio sem pessoas para checar", () => {
    expect(find([candidate()], { userIds: [] })).toEqual([])
  })
})

describe("findScheduleConflicts - chamados que não contam", () => {
  it.each(["DONE", "CANCELLED"] as const)("ignora chamado %s", (status) => {
    expect(find([candidate({ status })])).toEqual([])
  })

  it("conta chamado em andamento", () => {
    expect(find([candidate({ status: "IN_PROGRESS" })])).toHaveLength(1)
  })

  it("ignora chamado excluído", () => {
    expect(find([candidate({ deletedAt: new Date("2026-05-01T00:00:00.000Z") })])).toEqual([])
  })

  it("ignora o próprio chamado ao remanejar", () => {
    expect(find([candidate({ id: "d-proprio" })], { excludeDemandId: "d-proprio" })).toEqual([])
  })

  it("ainda acusa outro chamado ao remanejar", () => {
    const result = find(
      [candidate({ id: "d-proprio" }), candidate({ id: "d-outro" })],
      { excludeDemandId: "d-proprio" }
    )
    expect(result.map((c) => c.demandId)).toEqual(["d-outro"])
  })
})

describe("findScheduleConflicts - ordenação", () => {
  it("ordena por início e depois por nome", () => {
    const result = find(
      [
        candidate({ id: "d-tarde", inicioPrevisto: at("12:00"), fimPrevisto: at("14:00"), people: [joao] }),
        candidate({ id: "d-cedo", inicioPrevisto: at("10:00"), fimPrevisto: at("12:00"), people: [maria, joao] }),
      ],
      { userIds: [joao.userId, maria.userId] }
    )
    expect(result.map((c) => `${c.demandId}:${c.userName}`)).toEqual([
      "d-cedo:João Silva",
      "d-cedo:Maria Souza",
      "d-tarde:João Silva",
    ])
  })
})
