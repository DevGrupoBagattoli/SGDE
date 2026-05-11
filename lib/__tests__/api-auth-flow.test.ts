import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

describe("fluxo de auth na API client", () => {
  // Tipo explícito para o TypeScript não inferir `never` no `mockResolvedValue`.
  // A API client espera um `fetch` que retorna uma Promise e depois lê `ok/status/json()`.
  const fetchMock = jest.fn()

  type AuthApiResponse =
    | {
        success: false
        error: { code: string; message: string }
      }
    | {
        success: true
        data: { role: string; name: string }
        warnings: unknown[]
      }

  type FetchMockResolved = {
    ok: boolean
    status: number
    json: () => Promise<AuthApiResponse>
  }

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

    ;(
      fetchMock as unknown as {
        mockResolvedValue: (value: FetchMockResolved) => void
      }
    ).mockResolvedValue({
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

    ;(
      fetchMock as unknown as {
        mockResolvedValue: (value: FetchMockResolved) => void
      }
    ).mockResolvedValue({
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

    ;(
      fetchMock as unknown as {
        mockResolvedValue: (value: FetchMockResolved) => void
      }
    ).mockResolvedValue({
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
