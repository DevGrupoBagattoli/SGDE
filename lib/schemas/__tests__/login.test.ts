import { describe, expect, it } from "@jest/globals"

import { loginSchema } from "@/lib/schemas/login"

describe("loginSchema", () => {
  it("aceita payload gestor válido", () => {
    const r = loginSchema.safeParse({
      role: "gestor",
      name: "Maria",
      password: "secret",
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.role).toBe("gestor")
      expect(r.data.name).toBe("Maria")
    }
  })

  it("aceita payload eletricista válido", () => {
    const r = loginSchema.safeParse({
      role: "eletricista",
      name: "João",
      password: "1234",
    })
    expect(r.success).toBe(true)
  })

  it("rejeita role inválida", () => {
    const r = loginSchema.safeParse({
      role: "admin",
      name: "X",
      password: "y",
    })
    expect(r.success).toBe(false)
  })

  it("rejeita nome vazio", () => {
    const r = loginSchema.safeParse({
      role: "gestor",
      name: "",
      password: "x",
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("name"))).toBe(true)
    }
  })

  it("rejeita senha vazia", () => {
    const r = loginSchema.safeParse({
      role: "gestor",
      name: "Nome",
      password: "",
    })
    expect(r.success).toBe(false)
  })
})
