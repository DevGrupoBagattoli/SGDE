import bcrypt from "bcryptjs"

import { PrismaClient, UserRole, DemandStatus } from "@prisma/client"

const prisma = new PrismaClient()

const managers = [
  { name: "Gestor Operacional", password: "admin123" },
]

const electricians = [
  { name: "João Silva", password: "1234" },
  { name: "Mariana Costa", password: "1234" },
  { name: "Carlos Lima", password: "1234" },
  { name: "Equipe Beta", password: "1234" },
]

const parseDurationToMinutes = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})h$/)

  if (!match) {
    throw new Error(`Duração inválida: ${value}`)
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  return hours * 60 + minutes
}

const demandsSeed = [
  {
    tecnico: "João Silva",
    equipe: "Alpha",
    local: "Bloco A - Condomínio Solar",
    descricao: "Troca de fiação do quadro de força principal",
    status: DemandStatus.IN_PROGRESS,
    inicioPrevisto: "2026-04-30T10:00:00.000Z",
    duracaoPrevista: "02:00h",
    observacoes: "",
    participantes: [],
  },
  {
    tecnico: "Equipe Beta",
    equipe: "Beta",
    local: "Rua das Flores, 123",
    descricao: "Reparo em poste de iluminação interna",
    status: DemandStatus.PENDING,
    inicioPrevisto: "2026-04-30T14:00:00.000Z",
    duracaoPrevista: "01:30h",
    observacoes: "Aguardando chegada do material",
    participantes: [],
  },
  {
    tecnico: "Mariana Costa",
    equipe: "Gamma",
    local: "Galpão Logístico Norte",
    descricao: "Inspeção preventiva de disjuntores e aterramento",
    status: DemandStatus.PENDING,
    inicioPrevisto: "2026-05-01T08:30:00.000Z",
    duracaoPrevista: "03:00h",
    observacoes: "",
    participantes: [],
  },
  {
    tecnico: "Carlos Lima",
    equipe: "Alpha",
    local: "Hospital Municipal - Ala B",
    descricao: "Correção de oscilação no circuito de emergência",
    status: DemandStatus.DONE,
    inicioPrevisto: "2026-05-01T11:00:00.000Z",
    duracaoPrevista: "02:30h",
    observacoes: "Teste final realizado com a manutenção local.",
    participantes: [],
  },
]

async function main() {
  await prisma.demandAudit.deleteMany()
  await prisma.demandParticipant.deleteMany()
  await prisma.demand.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  for (const manager of managers) {
    await prisma.user.create({
      data: {
        name: manager.name,
        role: UserRole.MANAGER,
        passwordHash: await bcrypt.hash(manager.password, 10),
      },
    })
  }

  for (const electrician of electricians) {
    await prisma.user.create({
      data: {
        name: electrician.name,
        role: UserRole.ELECTRICIAN,
        passwordHash: await bcrypt.hash(electrician.password, 10),
      },
    })
  }

  const defaultCreator = await prisma.user.findFirstOrThrow({
    where: { role: UserRole.MANAGER },
  })

  for (const item of demandsSeed) {
    const technician = await prisma.user.findUniqueOrThrow({
      where: { name: item.tecnico },
    })

    const duration = parseDurationToMinutes(item.duracaoPrevista)
    const start = new Date(item.inicioPrevisto)
    const end = new Date(start.getTime() + duration * 60_000)

    await prisma.demand.create({
      data: {
        technicianId: technician.id,
        equipe: item.equipe,
        local: item.local,
        descricao: item.descricao,
        status: item.status,
        inicioPrevisto: start,
        fimPrevisto: end,
        duracaoMinutos: duration,
        observacoes: item.observacoes,
        createdById: defaultCreator.id,
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
