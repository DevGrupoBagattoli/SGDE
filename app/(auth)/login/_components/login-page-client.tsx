"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { LoginScreen } from "@/components/organisms/login-screen"
import { useSession } from "@/hooks/use-session"

type LoginPageClientProps = {
  technicians: { id: string; name: string }[]
}

export function LoginPageClient({ technicians }: LoginPageClientProps) {
  const router = useRouter()
  const { status, login } = useSession()
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-100 text-slate-700">
        Carregando...
      </main>
    )
  }

  return (
    <LoginScreen
      technicians={technicians}
      onLogin={async (credentials) => {
        setError("")
        try {
          await login(credentials)
          router.push("/dashboard")
        } catch (err) {
          setError(err instanceof Error ? err.message : "Falha no login")
        }
      }}
      error={error}
    />
  )
}
