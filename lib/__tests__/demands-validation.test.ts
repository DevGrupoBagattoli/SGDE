import {
  sameParticipants,
  validateDemandDescricao,
} from "@/lib/demands"

describe("validateDemandDescricao", () => {
  it("rejeita descrição curta", () => {
    expect(validateDemandDescricao("ab")).toMatch(/pelo menos 3/)
  })

  it("aceita descrição válida", () => {
    expect(validateDemandDescricao("  Inspeção  ")).toBeNull()
  })
})

describe("sameParticipants", () => {
  it("ignora ordem", () => {
    expect(sameParticipants(["Ana", "Bob"], ["Bob", "Ana"])).toBe(true)
  })

  it("detecta diferença", () => {
    expect(sameParticipants(["Ana"], ["Ana", "Bob"])).toBe(false)
  })
})
