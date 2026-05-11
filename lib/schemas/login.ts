import { z } from "zod"

export const loginSchema = z.object({
  role: z.enum(["gestor", "eletricista"]),
  name: z.string().min(1, "O nome é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
})

export type LoginInput = z.infer<typeof loginSchema>
