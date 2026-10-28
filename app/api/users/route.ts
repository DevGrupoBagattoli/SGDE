import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"
import {
  createUserSchema,
  hashPassword,
  isUniqueConstraintError,
  isUniqueConstraintErrorFor,
  apiRoleToDb,
  toUserDto,
} from "@/lib/server/users"
import { requireManager } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"

export async function GET() {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return jsonOk({
    users: users.map(toUserDto),
  })
}

export async function POST(request: Request) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const payload = await request.json().catch(() => null)
  const parsed = createUserSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  // E-mail vazio/ausente vira null (usuário sem fallback de e-mail).
  const email = parsed.data.email ? parsed.data.email : null

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        role: apiRoleToDb(parsed.data.role),
        passwordHash: await hashPassword(parsed.data.password),
        email,
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonOk({
      user: toUserDto(user),
    })
  } catch (error) {
    if (isUniqueConstraintErrorFor(error, "email")) {
      return jsonError(409, "CONFLICT", "Já existe um usuário com este e-mail", {
        field: "email",
        value: parsed.data.email,
        hint: "Informe um e-mail diferente",
      })
    }

    if (isUniqueConstraintError(error)) {
      return jsonError(409, "CONFLICT", "Já existe um usuário com este nome", {
        field: "name",
        value: parsed.data.name,
        hint: "Informe um nome de usuário diferente",
      })
    }

    throw error
  }
}
