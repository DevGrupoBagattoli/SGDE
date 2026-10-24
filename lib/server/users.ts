import bcrypt from "bcryptjs"
import { Prisma, User, UserRole } from "@prisma/client"
import { z } from "zod"

export const userRoleSchema = z.enum(["gestor", "eletricista"])

export const USER_EMAIL_MAX_LENGTH = 254

// E-mail opcional: string vazia é aceita e significa "sem e-mail" (limpar no PATCH).
const userEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(
    USER_EMAIL_MAX_LENGTH,
    `O e-mail deve ter no máximo ${USER_EMAIL_MAX_LENGTH} caracteres`
  )
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Informe um e-mail válido",
  })

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: userRoleSchema,
  password: z.string().min(4).max(128),
  email: userEmailSchema.optional(),
})

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: userRoleSchema.optional(),
    password: z.string().min(4).max(128).optional(),
    email: userEmailSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização",
  })

export const apiRoleToDb = (role: z.infer<typeof userRoleSchema>) =>
  role === "gestor" ? UserRole.MANAGER : UserRole.ELECTRICIAN

export const dbRoleToApi = (role: UserRole): z.infer<typeof userRoleSchema> =>
  role === UserRole.MANAGER ? "gestor" : "eletricista"

export const toUserDto = (
  user: Pick<User, "id" | "name" | "role" | "email" | "createdAt" | "updatedAt">
) => ({
  id: user.id,
  name: user.name,
  role: dbRoleToApi(user.role),
  email: user.email,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
})

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10)
}

export const isUniqueConstraintError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

// P2002 pode vir de `name` ou `email`; `meta.target` identifica a coluna
// (array no PostgreSQL, string em outros conectores).
export const isUniqueConstraintErrorFor = (error: unknown, field: string) => {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false
  }

  const target = error.meta?.target

  if (Array.isArray(target)) {
    return target.includes(field)
  }

  return typeof target === "string" && target.includes(field)
}

export const isForeignKeyConstraintError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  )
}
