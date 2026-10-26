import { z } from "zod"

import { requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

// No zod 4, o RegExp de `protocol` é testado sem o ":" final (ex.: "https").
const endpointSchema = z.url({ protocol: /^https$/ })

const subscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
})

const unsubscribeSchema = z.object({
  endpoint: endpointSchema,
})

export async function POST(request: Request) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const payload = await request.json().catch(() => null)
  const parsed = subscribeSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  // O endpoint é a chave natural do dispositivo: se outro usuário ativou as
  // notificações no mesmo navegador, a subscription é reassociada ao atual.
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: auth.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent,
    },
    update: {
      userId: auth.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent,
    },
  })

  return jsonOk({ subscriptionId: subscription.id })
}

export async function DELETE(request: Request) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireAuth()

  if (auth.error) {
    return auth.error
  }

  const payload = await request.json().catch(() => null)
  const parsed = unsubscribeSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  // `userId` no where garante que ninguém remove subscription de outro usuário.
  const result = await prisma.pushSubscription.deleteMany({
    where: {
      endpoint: parsed.data.endpoint,
      userId: auth.user.id,
    },
  })

  if (result.count === 0) {
    return jsonError(
      404,
      "NOT_FOUND",
      "Subscription de push não encontrada para o usuário autenticado",
      { endpoint: parsed.data.endpoint }
    )
  }

  return jsonOk({ deleted: true })
}
