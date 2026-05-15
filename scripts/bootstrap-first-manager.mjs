import bcrypt from "bcryptjs"
import { PrismaClient, UserRole } from "@prisma/client"

const prisma = new PrismaClient()

const name = process.env.FIRST_MANAGER_NAME?.trim()
const password = process.env.FIRST_MANAGER_PASSWORD

const assertInput = () => {
  if (!name) {
    throw new Error("FIRST_MANAGER_NAME nao definido")
  }

  if (!password) {
    throw new Error("FIRST_MANAGER_PASSWORD nao definido")
  }

  if (password.length < 8) {
    throw new Error("FIRST_MANAGER_PASSWORD deve ter ao menos 8 caracteres")
  }
}

async function main() {
  const managersCount = await prisma.user.count({
    where: { role: UserRole.MANAGER },
  })

  if (managersCount > 0) {
    console.log("Bootstrap ignorado: ja existe gestor cadastrado.")
    return
  }

  assertInput()

  const existingUser = await prisma.user.findUnique({
    where: { name },
    select: { id: true, role: true },
  })

  if (existingUser) {
    throw new Error(
      `Usuario '${name}' ja existe com role '${existingUser.role}'. Ajuste FIRST_MANAGER_NAME para continuar.`
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      name,
      role: UserRole.MANAGER,
      passwordHash,
    },
  })

  console.log(`Primeiro gestor criado com sucesso: ${name}`)
}

main()
  .catch((error) => {
    console.error("Falha no bootstrap do primeiro gestor:", error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })