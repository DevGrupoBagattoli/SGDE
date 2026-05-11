import bcrypt from "bcryptjs"
import { Prisma, User, UserRole } from "@prisma/client"
import { z } from "zod"

export const userRoleSchema = z.enum(["gestor", "eletricista"])

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: userRoleSchema,
  password: z.string().min(4).max(128),
})

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: userRoleSchema.optional(),
    password: z.string().min(4).max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização",
  })

export const apiRoleToDb = (role: z.infer<typeof userRoleSchema>) =>
  role === "gestor" ? UserRole.MANAGER : UserRole.ELECTRICIAN

export const dbRoleToApi = (role: UserRole): z.infer<typeof userRoleSchema> =>
  role === UserRole.MANAGER ? "gestor" : "eletricista"

export const toUserDto = (user: Pick<User, "id" | "name" | "role" | "createdAt" | "updatedAt">) => ({
  id: user.id,
  name: user.name,
  role: dbRoleToApi(user.role),
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

export const isForeignKeyConstraintError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  )
}
