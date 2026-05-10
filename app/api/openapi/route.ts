import { jsonOk } from "@/lib/server/http"

const openApiV1 = {
  openapi: "3.0.3",
  info: {
    title: "SGDE API",
    version: "1.0.0",
  },
  paths: {
    "/api/auth/login": { post: { summary: "Login" } },
    "/api/auth/me": { get: { summary: "Sessão atual" } },
    "/api/auth/refresh": { post: { summary: "Refresh de sessão" } },
    "/api/auth/logout": { post: { summary: "Logout" } },
    "/api/demands": {
      get: { summary: "Listar demandas" },
      post: { summary: "Criar demanda" },
    },
    "/api/demands/{id}/status": { patch: { summary: "Atualizar status" } },
    "/api/demands/{id}/schedule": { patch: { summary: "Atualizar agenda" } },
    "/api/demands/{id}/history": { get: { summary: "Histórico da demanda" } },
    "/api/technicians": { get: { summary: "Listar técnicos" } },
  },
}

export async function GET() {
  return jsonOk(openApiV1)
}
