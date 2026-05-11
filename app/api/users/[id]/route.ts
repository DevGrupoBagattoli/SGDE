import { jsonError, jsonOk, jsonValidationError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"
import {
  apiRoleToDb,
  hashPassword,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
  toUserDto,
  updateUserSchema,
} from "@/lib/server/users"
import { requireManager } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return jsonError(404, "NOT_FOUND", "Usuário não encontrado para o identificador informado", {
      userId: id,
    })
  }

  return jsonOk({
    user: toUserDto(user),
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params
  const payload = await request.json().catch(() => null)
  const parsed = updateUserSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonValidationError("Valores inválido", parsed.error.flatten())
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
    },
  })

  if (!existingUser) {
    return jsonError(404, "NOT_FOUND", "Usuário não encontrado para o identificador informado", {
      userId: id,
    })
  }

  if (
    existingUser.id === auth.user.id &&
    parsed.data.role &&
    parsed.data.role !== "gestor"
  ) {
    return jsonError(
      409,
      "CONFLICT",
      "Não é permitido rebaixar o próprio usuário autenticado de gestor para eletricista",
      {
        userId: auth.user.id,
        attemptedRole: parsed.data.role,
      }
    )
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.role ? { role: apiRoleToDb(parsed.data.role) } : {}),
        ...(parsed.data.password
          ? { passwordHash: await hashPassword(parsed.data.password) }
          : {}),
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

export async function DELETE(_: Request, { params }: RouteParams) {
  const csrfError = await validateCsrf()

  if (csrfError) {
    return csrfError
  }

  const auth = await requireManager()

  if (auth.error) {
    return auth.error
  }

  const { id } = await params

  if (id === auth.user.id) {
    return jsonError(409, "CONFLICT", "Não é permitido deletar o próprio usuário autenticado", {
      userId: auth.user.id,
      reason: "A ação removeria o único contexto autenticado atual",
    })
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!existingUser) {
    return jsonError(404, "NOT_FOUND", "Usuário não encontrado para o identificador informado", {
      userId: id,
    })
  }

  try {
    await prisma.user.delete({
      where: { id },
    })
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return jsonError(
        409,
        "CONFLICT",
        "Não é possível deletar um usuário vinculado a demandas, auditorias ou outras relações",
        {
          userId: id,
          hint: "Remova ou transfira os vínculos existentes antes de tentar novamente",
        }
      )
    }

    throw error
  }

  return jsonOk({
    deletedUser: toUserDto(existingUser),
  })
}
