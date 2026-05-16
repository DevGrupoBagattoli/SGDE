import { validateUserName, validateUserPassword } from "@/lib/users"

describe("validateUserPassword", () => {
  it("exige senha na criação", () => {
    expect(validateUserPassword("", { required: true })).toMatch(/obrigatória/)
  })

  it("rejeita senha curta", () => {
    expect(validateUserPassword("abc", { required: true })).toMatch(/pelo menos 4/)
  })

  it("permite vazio na edição", () => {
    expect(validateUserPassword("", { required: false })).toBeNull()
  })
})

describe("validateUserName", () => {
  it("rejeita nome curto", () => {
    expect(validateUserName("a")).toMatch(/pelo menos 2/)
  })
})
