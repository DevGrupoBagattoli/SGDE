import { UserSession } from "@/lib/auth"
import { Demand, DemandStatus } from "@/lib/demands"

type ApiSuccess<T> = {
  success: true
  data: T
  warnings?: Array<{ code: string; message: string }>
}

type ApiFailure = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure

const readCookie = (name: string) => {
  if (typeof document === "undefined") {
    return null
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null
}

const withCsrf = (method: string) => {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    return {}
  }

  const csrf = readCookie("sgde_csrf")
  return csrf ? { "x-csrf-token": csrf } : {}
}

let unauthorizedHandler: (() => void) | null = null

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler
}

const request = async <T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; warnings: Array<{ code: string; message: string }> }> => {
  const method = init.method ?? "GET"
  const headers = new Headers(init.headers)

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const csrfHeaders = withCsrf(method)
  Object.entries(csrfHeaders).forEach(([key, value]) => {
    headers.set(key, value)
  })

  const isCredentialsEndpoint = path === "/api/auth/login"

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  })

  if (response.status === 401 && !isCredentialsEndpoint && unauthorizedHandler) {
    unauthorizedHandler()
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload || !payload.success) {
    throw new Error(payload && !payload.success ? payload.error.message : "Erro inesperado de API")
  }

  return {
    data: payload.data,
    warnings: payload.warnings ?? [],
  }
}

export const apiLogin = async (input: {
  role: "gestor" | "eletricista"
  name: string
  password: string
}) => {
  const result = await request<UserSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data
}

export const apiMe = async () => {
  const result = await request<UserSession>("/api/auth/me")
  return result.data
}

export const apiRefresh = async () => {
  const result = await request<UserSession>("/api/auth/refresh", { method: "POST" })
  return result.data
}

export const apiLogout = async () => {
  await request<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" })
}

export const apiGetTechnicians = async () => {
  const result = await request<{ technicians: Array<{ id: string; name: string }> }>(
    "/api/technicians"
  )
  return result.data.technicians
}

export const apiGetDemands = async () => {
  const result = await request<{ demands: Demand[] }>("/api/demands")
  return result.data.demands
}

export const apiCreateDemand = async (payload: Omit<Demand, "id" | "version" | "dateKeys" | "horarioFim">) => {
  const result = await request<{ demand: Demand }>("/api/demands", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return result
}

export const apiUpdateStatus = async (id: string, status: DemandStatus, version: number) => {
  const result = await request<{ demand: Demand }>(`/api/demands/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, version }),
  })

  return result
}

export const apiUpdateSchedule = async (
  id: string,
  payload: {
    horarioInicio: string
    duracaoPrevista: string
    observacoes: string
    participantes: string[]
    version: number
  }
) => {
  const result = await request<{ demand: Demand }>(`/api/demands/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })

  return result
}

export type UserDto = {
  id: string
  name: string
  role: "gestor" | "eletricista"
  createdAt: string
  updatedAt: string
}

export const apiGetUsers = async () => {
  const result = await request<{ users: UserDto[] }>("/api/users")
  return result.data.users
}

export const apiCreateUser = async (payload: {
  name: string
  role: "gestor" | "eletricista"
  password?: string
}) => {
  const result = await request<{ user: UserDto }>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return result
}

export const apiUpdateUser = async (
  id: string,
  payload: {
    name?: string
    role?: "gestor" | "eletricista"
    password?: string
  }
) => {
  const result = await request<{ user: UserDto }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return result
}

export const apiDeleteUser = async (id: string) => {
  const result = await request<{ deletedUser: UserDto }>(`/api/users/${id}`, {
    method: "DELETE",
  })
  return result
}

