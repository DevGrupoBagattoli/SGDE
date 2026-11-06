import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import { GET as getConflicts } from "@/app/api/demands/conflicts/route"
import { POST as createDemand } from "@/app/api/demands/route"
import { PATCH as updateSchedule } from "@/app/api/demands/[id]/schedule/route"
import { requireAuth } from "@/lib/server/auth"
import { validateCsrf } from "@/lib/server/csrf"
import { prisma } from "@/lib/server/prisma"

// As factories não podem referenciar variáveis externas (hoisting do jest.mock).
jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    demand: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock("@/lib/server/auth", () => ({
  ...jest.requireActual<typeof import("@/lib/server/auth")>("@/lib/server/auth"),
  requireAuth: jest.fn(),
}))

jest.mock("@/lib/server/csrf", () => ({ validateCsrf: jest.fn() }))
jest.mock("@/lib/notifications/demand-events", () => ({ notifyDemandEvent: jest.fn() }))

type Mock = jest.Mock<(...args: unknown[]) => Promise<unknown>>

const db = prisma as unknown as {
  user: { findUnique: Mock; findMany: Mock }
  demand: { findMany: Mock; findUnique: Mock; create: Mock }
  $transaction: Mock
}
const requireAuthMock = requireAuth as unknown as Mock
const validateCsrfMock = validateCsrf as unknown as Mock

const user = (id: string, name: string, role: "MANAGER" | "ELECTRICIAN") => ({
  id,
  name,
  role,
})
const GESTOR = user("u-gestor", "Gestora", "MANAGER")
const JOAO = user("u-joao", "João Silva", "ELECTRICIAN")
const MARIA = user("u-maria", "Maria Souza", "ELECTRICIAN")
const PEDRO = user("u-pedro", "Pedro Lima", "ELECTRICIAN")

// 10:00 a 12:00 em Vilhena/RO (UTC-4)
const INICIO = "2026-05-11T14:00:00.000Z"

/** Chamado já gravado de 09:00 a 11:00 local, que sobrepõe INICIO + 2h. */
const existing = (overrides: Record<string, unknown> = {}) => ({
  id: "d-outro",
  local: "Bloco B",
  status: "PENDING",
  deletedAt: null,
  inicioPrevisto: new Date("2026-05-11T13:00:00.000Z"),
  fimPrevisto: new Date("2026-05-11T15:00:00.000Z"),
  technicianId: JOAO.id,
  technician: JOAO,
  participants: [] as Array<{ userId: string; user: typeof JOAO }>,
  ...overrides,
})

const login = (who: typeof GESTOR | typeof JOAO) =>
  requireAuthMock.mockResolvedValue({ user: who, error: undefined })

const post = (body: Record<string, unknown>) =>
  createDemand(
    new Request("http://localhost/api/demands", {
      method: "POST",
      body: JSON.stringify({
        tecnico: JOAO.name,
        equipe: "Sem equipe",
        local: "Subestação X",
        descricao: "Troca de disjuntor",
        horarioInicio: INICIO,
        duracaoPrevista: "02:00h",
        status: "Pendente",
        ...body,
      }),
    })
  )

const createdDemand = () => ({
  id: "d-novo",
  equipe: "Sem equipe",
  local: "Subestação X",
  descricao: "Troca de disjuntor",
  status: "PENDING",
  inicioPrevisto: new Date(INICIO),
  fimPrevisto: new Date("2026-05-11T16:00:00.000Z"),
  duracaoMinutos: 120,
  observacoes: "",
  version: 1,
  technician: JOAO,
  createdBy: GESTOR,
  participants: [],
})

const auditsOfCreate = () => {
  const call = db.demand.create.mock.calls[0][0] as {
    data: { audits: { create: Array<Record<string, unknown>> } }
  }
  return call.data.audits.create
}

beforeEach(() => {
  jest.resetAllMocks()
  validateCsrfMock.mockResolvedValue(null)
  login(GESTOR)
  db.user.findUnique.mockResolvedValue(JOAO)
  db.user.findMany.mockResolvedValue([])
  db.demand.findMany.mockResolvedValue([])
  db.demand.create.mockResolvedValue(createdDemand())
})

describe("POST /api/demands - conflito de agenda", () => {
  it("salva sem aviso quando ninguém está ocupado", async () => {
    const response = await post({})

    expect(response.status).toBe(200)
    expect(auditsOfCreate().map((a) => a.action)).toEqual(["CREATE"])
  })

  it("retorna 409 com os conflitos e não salva sem confirmação", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await post({})
    const body = (await response.json()) as {
      error: { code: string; message: string; details: { reason: string; conflitos: unknown[] } }
    }

    expect(response.status).toBe(409)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.message).toContain("João Silva")
    expect(body.error.message).toContain("Bloco B")
    expect(body.error.details.reason).toBe("SCHEDULE_CONFLICT")
    expect(body.error.details.conflitos).toEqual([
      {
        userId: JOAO.id,
        userName: JOAO.name,
        demandId: "d-outro",
        local: "Bloco B",
        inicio: "2026-05-11T13:00:00.000Z",
        fim: "2026-05-11T15:00:00.000Z",
        restrito: false,
      },
    ])
    expect(db.demand.create).not.toHaveBeenCalled()
  })

  it("salva e audita quando o gestor confirma o conflito", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await post({ confirmarConflito: true })

    expect(response.status).toBe(200)
    const audits = auditsOfCreate()
    expect(audits.map((a) => a.action)).toEqual(["CREATE", "CONFIRM_CONFLICT"])
    expect(audits[1]).toMatchObject({
      actorUserId: GESTOR.id,
      field: "conflito",
      previousValue: null,
    })
    // o resumo vem do cálculo do servidor, com chamado e local
    expect(audits[1].nextValue).toContain("João Silva")
    expect(audits[1].nextValue).toContain("Bloco B")
    expect(audits[1].nextValue).toContain("d-outro")
  })

  it("ignora a confirmação e não audita quando não há conflito", async () => {
    const response = await post({ confirmarConflito: true })

    expect(response.status).toBe(200)
    expect(auditsOfCreate().map((a) => a.action)).toEqual(["CREATE"])
  })

  it("acusa conflito só do participante", async () => {
    db.user.findMany.mockResolvedValue([MARIA])
    db.demand.findMany.mockResolvedValue([
      existing({
        technicianId: PEDRO.id,
        technician: PEDRO,
        participants: [{ userId: MARIA.id, user: MARIA }],
      }),
    ])

    const response = await post({ participantes: [MARIA.name] })
    const body = (await response.json()) as {
      error: { details: { conflitos: Array<{ userName: string }> } }
    }

    expect(response.status).toBe(409)
    expect(body.error.details.conflitos.map((c) => c.userName)).toEqual([MARIA.name])
  })

  it("lista todas as pessoas ocupadas", async () => {
    db.user.findMany.mockResolvedValue([MARIA])
    db.demand.findMany.mockResolvedValue([
      existing({ participants: [{ userId: MARIA.id, user: MARIA }] }),
    ])

    const response = await post({ participantes: [MARIA.name] })
    const body = (await response.json()) as {
      error: { details: { conflitos: Array<{ userName: string }> } }
    }

    expect(body.error.details.conflitos.map((c) => c.userName).sort()).toEqual([
      JOAO.name,
      MARIA.name,
    ])
  })

  it("não consulta conflito quando o chamado nasce concluído", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await post({ status: "Concluído" })

    expect(response.status).toBe(200)
    expect(db.demand.findMany).not.toHaveBeenCalled()
  })
})

const patchSchedule = (body: Record<string, unknown>) =>
  updateSchedule(
    new Request("http://localhost/api/demands/d-1/schedule", {
      method: "PATCH",
      body: JSON.stringify({
        horarioInicio: INICIO,
        duracaoPrevista: "02:00h",
        observacoes: "Remanejado",
        participantes: [],
        version: 1,
        ...body,
      }),
    }),
    { params: Promise.resolve({ id: "d-1" }) }
  )

const ownDemand = (overrides: Record<string, unknown> = {}) => ({
  id: "d-1",
  status: "PENDING",
  deletedAt: null,
  technicianId: JOAO.id,
  technician: JOAO,
  version: 1,
  // 08:00 a 10:00 local: remanejar para INICIO move o chamado
  inicioPrevisto: new Date("2026-05-11T12:00:00.000Z"),
  fimPrevisto: new Date("2026-05-11T14:00:00.000Z"),
  participants: [] as Array<{ userId: string; user: typeof JOAO }>,
  ...overrides,
})

const tx = {
  demandParticipant: { deleteMany: jest.fn() as Mock },
  demand: { update: jest.fn() as Mock },
  demandAudit: { createMany: jest.fn() as Mock },
}

const auditsOfSchedule = () => {
  const call = tx.demandAudit.createMany.mock.calls[0][0] as {
    data: Array<Record<string, unknown>>
  }
  return call.data
}

describe("PATCH /api/demands/[id]/schedule - conflito de agenda", () => {
  beforeEach(() => {
    db.demand.findUnique.mockResolvedValue(ownDemand())
    db.$transaction.mockImplementation(async (callback: unknown) =>
      (callback as (client: typeof tx) => Promise<unknown>)(tx)
    )
    tx.demandParticipant.deleteMany.mockResolvedValue({ count: 0 })
    tx.demandAudit.createMany.mockResolvedValue({ count: 3 })
    tx.demand.update.mockResolvedValue({
      ...createdDemand(),
      id: "d-1",
      version: 2,
    })
  })

  it("salva sem aviso quando ninguém está ocupado", async () => {
    const response = await patchSchedule({})

    expect(response.status).toBe(200)
    expect(auditsOfSchedule().map((a) => a.action)).not.toContain("CONFIRM_CONFLICT")
  })

  it("não conflita com o próprio chamado", async () => {
    db.demand.findMany.mockResolvedValue([
      existing({ id: "d-1", technicianId: JOAO.id, technician: JOAO }),
    ])

    const response = await patchSchedule({})

    expect(response.status).toBe(200)
    expect(db.demand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "d-1" } }),
      })
    )
  })

  it("retorna 409 com os conflitos e não salva sem confirmação", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await patchSchedule({})
    const body = (await response.json()) as {
      error: { code: string; details: { reason: string; conflitos: Array<{ userName: string }> } }
    }

    expect(response.status).toBe(409)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.details.reason).toBe("SCHEDULE_CONFLICT")
    expect(body.error.details.conflitos.map((c) => c.userName)).toEqual([JOAO.name])
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("salva e audita quando o gestor confirma", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await patchSchedule({ confirmarConflito: true })

    expect(response.status).toBe(200)
    const confirmation = auditsOfSchedule().find((a) => a.action === "CONFIRM_CONFLICT")
    expect(confirmation).toMatchObject({
      demandId: "d-1",
      actorUserId: GESTOR.id,
      field: "conflito",
    })
    expect(confirmation?.nextValue).toContain("Bloco B")
  })

  it("ignora a confirmação e não audita quando não há conflito", async () => {
    const response = await patchSchedule({ confirmarConflito: true })

    expect(response.status).toBe(200)
    expect(auditsOfSchedule().map((a) => a.action)).not.toContain("CONFIRM_CONFLICT")
  })

  it("checa os participantes que ficam depois da edição", async () => {
    db.user.findMany.mockResolvedValue([MARIA])
    db.demand.findMany.mockResolvedValue([
      existing({
        technicianId: PEDRO.id,
        technician: PEDRO,
        participants: [{ userId: MARIA.id, user: MARIA }],
      }),
    ])

    const response = await patchSchedule({ participantes: [MARIA.name] })
    const body = (await response.json()) as {
      error: { details: { conflitos: Array<{ userName: string }> } }
    }

    expect(response.status).toBe(409)
    expect(body.error.details.conflitos.map((c) => c.userName)).toEqual([MARIA.name])
  })

  it("não checa quando só a observação muda", async () => {
    db.demand.findUnique.mockResolvedValue(
      ownDemand({
        inicioPrevisto: new Date(INICIO),
        fimPrevisto: new Date("2026-05-11T16:00:00.000Z"),
      })
    )
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await patchSchedule({ observacoes: "Só uma nota" })

    expect(response.status).toBe(200)
    expect(db.demand.findMany).not.toHaveBeenCalled()
  })

  it("checa ao reativar um chamado concluído", async () => {
    db.demand.findUnique.mockResolvedValue(
      ownDemand({
        status: "DONE",
        inicioPrevisto: new Date(INICIO),
        fimPrevisto: new Date("2026-05-11T16:00:00.000Z"),
      })
    )
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await patchSchedule({ status: "Pendente", observacoes: "" })

    expect(response.status).toBe(409)
  })

  it("não checa chamado concluído que continua concluído", async () => {
    db.demand.findUnique.mockResolvedValue(ownDemand({ status: "DONE" }))
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await patchSchedule({})

    expect(response.status).toBe(200)
    expect(db.demand.findMany).not.toHaveBeenCalled()
  })

  it("esconde detalhes de chamados que o eletricista não pode ver", async () => {
    login(JOAO)
    db.user.findMany.mockResolvedValue([MARIA])
    // Maria está ocupada em um chamado de Pedro, do qual João não participa
    db.demand.findMany.mockResolvedValue([
      existing({
        technicianId: PEDRO.id,
        technician: PEDRO,
        participants: [{ userId: MARIA.id, user: MARIA }],
      }),
    ])

    const response = await patchSchedule({ participantes: [MARIA.name] })
    const body = (await response.json()) as {
      error: { message: string; details: { conflitos: Array<Record<string, unknown>> } }
    }

    expect(response.status).toBe(409)
    expect(body.error.details.conflitos).toEqual([
      {
        userId: MARIA.id,
        userName: MARIA.name,
        demandId: null,
        local: null,
        inicio: null,
        fim: null,
        restrito: true,
      },
    ])
    expect(body.error.message).not.toContain("Bloco B")
    expect(body.error.message).not.toContain("d-outro")
  })
})

const get = (query: Record<string, string>) =>
  getConflicts(
    new Request(`http://localhost/api/demands/conflicts?${new URLSearchParams(query)}`)
  )

describe("GET /api/demands/conflicts", () => {
  const query = { inicio: INICIO, duracao: "02:00h", usuarios: JOAO.name }

  beforeEach(() => {
    db.user.findMany.mockResolvedValue([JOAO])
  })

  it("lista os conflitos com detalhes para o gestor", async () => {
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await get(query)
    const body = (await response.json()) as {
      success: boolean
      data: { conflitos: Array<Record<string, unknown>> }
    }

    expect(response.status).toBe(200)
    expect(body.data.conflitos).toEqual([
      expect.objectContaining({ userName: JOAO.name, demandId: "d-outro", local: "Bloco B", restrito: false }),
    ])
  })

  it("devolve lista vazia sem conflito", async () => {
    const response = await get(query)
    const body = (await response.json()) as { data: { conflitos: unknown[] } }

    expect(body.data.conflitos).toEqual([])
  })

  it("passa excluir como chamado ignorado", async () => {
    await get({ ...query, excluir: "d-1" })

    expect(db.demand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "d-1" } }),
      })
    )
  })

  it("esconde detalhes de chamados que o eletricista não pode ver", async () => {
    login(JOAO)
    db.user.findMany.mockResolvedValue([MARIA])
    db.demand.findMany.mockResolvedValue([
      existing({
        technicianId: PEDRO.id,
        technician: PEDRO,
        participants: [{ userId: MARIA.id, user: MARIA }],
      }),
    ])

    const response = await get({ ...query, usuarios: MARIA.name })
    const body = (await response.json()) as { data: { conflitos: Array<Record<string, unknown>> } }

    expect(body.data.conflitos).toEqual([
      {
        userId: MARIA.id,
        userName: MARIA.name,
        demandId: null,
        local: null,
        inicio: null,
        fim: null,
        restrito: true,
      },
    ])
  })

  it("mostra detalhes ao eletricista quando o chamado é dele", async () => {
    login(JOAO)
    db.demand.findMany.mockResolvedValue([existing()])

    const response = await get(query)
    const body = (await response.json()) as { data: { conflitos: Array<Record<string, unknown>> } }

    expect(body.data.conflitos[0]).toMatchObject({ demandId: "d-outro", local: "Bloco B", restrito: false })
  })

  it("responde 422 para parâmetros inválidos", async () => {
    const response = await get({ inicio: "ontem", duracao: "2h", usuarios: "" })

    expect(response.status).toBe(422)
  })

  it("exige autenticação", async () => {
    requireAuthMock.mockResolvedValue({
      error: new Response(JSON.stringify({ success: false }), { status: 401 }),
    })

    const response = await get(query)

    expect(response.status).toBe(401)
    expect(db.demand.findMany).not.toHaveBeenCalled()
  })
})
