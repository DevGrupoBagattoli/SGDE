import crypto from "node:crypto"

import bcrypt from "bcryptjs"
import { User, UserRole } from "@prisma/client"
import { cookies } from "next/headers"

import { CSRF_COOKIE_NAME } from "@/lib/server/csrf"
import { jsonError } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export const ACCESS_COOKIE_NAME = "sgde_access"
export const REFRESH_COOKIE_NAME = "sgde_refresh"

const ACCESS_TTL_SECONDS = 60 * 15
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7
const isProd = process.env.NODE_ENV === "production"

const makeToken = () => crypto.randomBytes(32).toString("base64url")

export const roleFromDb = (role: UserRole): "gestor" | "eletricista" =>
  role === UserRole.MANAGER ? "gestor" : "eletricista"

const roleToDb = (role: "gestor" | "eletricista") =>
  role === "gestor" ? UserRole.MANAGER : UserRole.ELECTRICIAN

export const verifyPassword = async (plain: string, passwordHash: string) => {
  return bcrypt.compare(plain, passwordHash)
}

export const findUserByLogin = async (role: "gestor" | "eletricista", name: string) => {
  return prisma.user.findFirst({
    where: {
      role: roleToDb(role),
      name: name.trim(),
    },
  })
}

export const createSession = async (userId: string) => {
  const accessToken = makeToken()
  const refreshToken = makeToken()
  const csrfToken = makeToken()

  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000)
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)

  await prisma.session.create({
    data: {
      userId,
      accessToken,
      refreshToken,
      csrfToken,
      accessExpiresAt,
      refreshExpiresAt,
    },
  })

  return {
    accessToken,
    refreshToken,
    csrfToken,
    accessExpiresAt,
    refreshExpiresAt,
  }
}

export const setSessionCookies = async (session: {
  accessToken: string
  refreshToken: string
  csrfToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}) => {
  const cookieStore = await cookies()

  cookieStore.set(ACCESS_COOKIE_NAME, session.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: session.accessExpiresAt,
  })

  cookieStore.set(REFRESH_COOKIE_NAME, session.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: session.refreshExpiresAt,
  })

  cookieStore.set(CSRF_COOKIE_NAME, session.csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: session.refreshExpiresAt,
  })
}

export const clearSessionCookies = async () => {
  const cookieStore = await cookies()

  cookieStore.set(ACCESS_COOKIE_NAME, "", { path: "/", maxAge: 0 })
  cookieStore.set(REFRESH_COOKIE_NAME, "", { path: "/", maxAge: 0 })
  cookieStore.set(CSRF_COOKIE_NAME, "", { path: "/", maxAge: 0 })
}

export const getAuthenticatedUser = async () => {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value

  if (!accessToken) {
    return null
  }

  const session = await prisma.session.findFirst({
    where: {
      accessToken,
      revokedAt: null,
      accessExpiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })

  if (!session) {
    return null
  }

  return {
    user: session.user,
    session,
  }
}

export const requireAuth = async () => {
  const auth = await getAuthenticatedUser()

  if (!auth) {
    return {
      error: jsonError(401, "UNAUTHORIZED", "Sessão inválida ou expirada"),
    }
  }

  return {
    user: auth.user,
    session: auth.session,
  }
}

export const canViewDemand = (user: User, demand: {
  technicianId: string
  participants: Array<{ userId: string }>
}) => {
  if (user.role === UserRole.MANAGER) {
    return true
  }

  if (demand.technicianId === user.id) {
    return true
  }

  return demand.participants.some((participant) => participant.userId === user.id)
}

export const canEditDemand = (user: User, demand: { technicianId: string }) => {
  if (user.role === UserRole.MANAGER) {
    return true
  }

  return demand.technicianId === user.id
}

export const rotateRefreshSession = async () => {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value

  if (!refreshToken) {
    return { error: jsonError(401, "UNAUTHORIZED", "Refresh token ausente") }
  }

  const current = await prisma.session.findFirst({
    where: {
      refreshToken,
      revokedAt: null,
      refreshExpiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  })

  if (!current) {
    return { error: jsonError(401, "UNAUTHORIZED", "Refresh token inválido") }
  }

  await prisma.session.update({
    where: { id: current.id },
    data: { revokedAt: new Date() },
  })

  const next = await createSession(current.userId)
  await setSessionCookies(next)

  return {
    user: current.user,
  }
}
