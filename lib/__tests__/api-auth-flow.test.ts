import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

describe("fluxo de auth na API client", () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(async () => {
    const { setUnauthorizedHandler } = await import("@/lib/api")
    setUnauthorizedHandler(null)
  })

  it("dispara handler em 401 em rota protegida", async () => {
    const handler = jest.fn()
    const { apiMe, setUnauthorizedHandler } = await import("@/lib/api")
    setUnauthorizedHandler(handler)

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: "UNAUTH", message: "Não autorizado" },
      }),
    })

    await expect(apiMe()).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("não dispara handler em 401 no login", async () => {
    const handler = jest.fn()
    const { apiLogin, setUnauthorizedHandler } = await import("@/lib/api")
    setUnauthorizedHandler(handler)

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: "AUTH", message: "Credenciais inválidas" },
      }),
    })

    await expect(
      apiLogin({
        role: "gestor",
        name: "X",
        password: "y",
      })
    ).rejects.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it("login bem-sucedido retorna sessão", async () => {
    const { apiLogin, setUnauthorizedHandler } = await import("@/lib/api")
    setUnauthorizedHandler(null)

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { role: "gestor", name: "Ana" },
        warnings: [],
      }),
    })

    const session = await apiLogin({
      role: "gestor",
      name: "Ana",
      password: "secret",
    })

    expect(session).toEqual({ role: "gestor", name: "Ana" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          role: "gestor",
          name: "Ana",
          password: "secret",
        }),
      })
    )
  })
})
