import { z } from "zod"

import {
  createSession,
  findUserByLogin,
  roleFromDb,
  setSessionCookies,
  verifyPassword,
} from "@/lib/server/auth"
import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"

const bodySchema = z.object({
  role: z.enum(["gestor", "eletricista"]),
  name: z.string().min(2),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  const user = await findUserByLogin(parsed.data.role, parsed.data.name)

  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Credenciais inválidas para o perfil e nome informados", {
      role: parsed.data.role,
      reason: "Usuário não encontrado para o perfil selecionado",
    })
  }

  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash)

  if (!passwordOk) {
    return jsonError(401, "UNAUTHORIZED", "Credenciais inválidas para o perfil e nome informados", {
      role: parsed.data.role,
      reason: "Senha incorreta",
    })
  }

  const session = await createSession(user.id)
  await setSessionCookies(session)

  return jsonOk({
    name: user.name,
    role: roleFromDb(user.role),
  })
}
