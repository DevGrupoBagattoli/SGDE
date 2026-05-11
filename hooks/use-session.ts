"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
  setUnauthorizedHandler,
} from "@/lib/api"
import { UserSession } from "@/lib/auth"
import { LoginInput } from "@/lib/schemas/login"

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

export function useSession() {
  const router = useRouter()
  const [session, setSession] = useState<UserSession | null>(null)
  const [status, setStatus] = useState<SessionStatus>("loading")

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStatus("unauthenticated")
      setSession(null)
      router.replace("/login")
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [router])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      try {
        const me = await apiMe().catch(async () => apiRefresh())
        if (mounted) {
          setSession(me)
          setStatus("authenticated")
        }
      } catch {
        if (mounted) {
          setSession(null)
          setStatus("unauthenticated")
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  const login = useCallback(async (credentials: LoginInput) => {
    const nextSession = await apiLogin(credentials)
    setSession(nextSession)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setSession(null)
      setStatus("unauthenticated")
      router.replace("/login")
    }
  }, [router])

  return {
    session,
    status,
    login,
    logout,
  }
}
