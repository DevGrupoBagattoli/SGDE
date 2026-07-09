import { UserSession } from "@/lib/auth"
import { Demand, DemandStatus } from "@/lib/demands"
import type {
  ReportAuditRow,
  ReportDemandRow,
  ReportOccupationTechnician,
  ReportProductivityRow,
} from "@/lib/reports"

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

export const apiUpdateDescricao = async (id: string, descricao: string, version: number) => {
  const result = await request<{ demand: Demand }>(`/api/demands/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ descricao, version }),
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

export const apiDeleteDemand = async (id: string) => {
  const result = await request<{ deleted: boolean; demandId: string }>(`/api/demands/${id}`, {
    method: "DELETE",
  })
  return result
}

const downloadCsv = async (path: string, params: URLSearchParams, filename: string) => {
  const query = new URLSearchParams(params)
  query.set("export", "csv")

  const headers = new Headers()
  const csrfHeaders = withCsrf("GET")
  Object.entries(csrfHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value)
  })

  const response = await fetch(`${path}?${query.toString()}`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  })

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler()
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiFailure | null
    throw new Error(payload?.error.message ?? "Falha ao exportar relatório")
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const apiReportDemands = async (params: URLSearchParams) => {
  const result = await request<{ demands: ReportDemandRow[]; total: number }>(
    `/api/reports/demands?${params.toString()}`
  )
  return result.data
}

export const apiReportDemandsCsv = (params: URLSearchParams) =>
  downloadCsv("/api/reports/demands", params, "relatorio-demandas.csv")

export const apiReportProductivity = async (params: URLSearchParams) => {
  const result = await request<{
    technicians: ReportProductivityRow[]
    total: number
  }>(`/api/reports/productivity?${params.toString()}`)
  return result.data
}

export const apiReportProductivityCsv = (params: URLSearchParams) =>
  downloadCsv("/api/reports/productivity", params, "relatorio-produtividade.csv")

export const apiReportAudit = async (params: URLSearchParams) => {
  const result = await request<{ entries: ReportAuditRow[]; total: number }>(
    `/api/reports/audit?${params.toString()}`
  )
  return result.data
}

export const apiReportAuditCsv = (params: URLSearchParams) =>
  downloadCsv("/api/reports/audit", params, "relatorio-auditoria.csv")

export const apiReportOccupation = async (params: URLSearchParams) => {
  const result = await request<{
    technicians: ReportOccupationTechnician[]
    dateRange: string[]
  }>(`/api/reports/occupation?${params.toString()}`)
  return result.data
}

