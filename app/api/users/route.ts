import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"
import {
  createUserSchema,
  hashPassword,
  isUniqueConstraintError,
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

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        role: apiRoleToDb(parsed.data.role),
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonOk({
      user: toUserDto(user),
    })
  } catch (error) {
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
