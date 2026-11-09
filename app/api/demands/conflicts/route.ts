import { z } from "zod"

import { requireAuth } from "@/lib/server/auth"
import { detectScheduleConflicts } from "@/lib/server/demand-conflicts"
import { parseDurationMinutes } from "@/lib/server/dates"
import { jsonOk, jsonValidationError } from "@/lib/server/http"

const MAX_USERS = 50

const querySchema = z.object({
  inicio: z.iso.datetime(),
  duracao: z.string().regex(/^\d{2}:\d{2}h$/),
  usuarios: z.array(z.string().min(1)).min(1).max(MAX_USERS),
  excluir: z.string().min(1).optional(),
})

/** Aviso antecipado para os formulários: quem já está ocupado em [início, início + duração). */
export async function GET(request: Request) {
  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const params = new URL(request.url).searchParams
  const parsed = querySchema.safeParse({
    inicio: params.get("inicio") ?? undefined,
    duracao: params.get("duracao") ?? undefined,
    usuarios: params.getAll("usuarios").map((name) => name.trim()).filter(Boolean),
    excluir: params.get("excluir") || undefined,
  })

  if (!parsed.success) {
    return jsonValidationError("Valores inválido nos parâmetros de consulta", parsed.error.flatten())
  }

  let durationMinutes: number

  try {
    durationMinutes = parseDurationMinutes(parsed.data.duracao)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duração inválida"
    return jsonValidationError("Valores inválido nos parâmetros de consulta", {
      fieldErrors: { duracao: [message] },
    })
  }

  if (durationMinutes <= 0) {
    return jsonValidationError("Valores inválido nos parâmetros de consulta", {
      fieldErrors: { duracao: ["A duração precisa ser maior que zero"] },
    })
  }

  const start = new Date(parsed.data.inicio)
  const end = new Date(start.getTime() + durationMinutes * 60_000)

  const { visible } = await detectScheduleConflicts(auth.user, {
    start,
    end,
    userNames: parsed.data.usuarios,
    excludeDemandId: parsed.data.excluir,
  })

  return jsonOk({ conflitos: visible })
}
