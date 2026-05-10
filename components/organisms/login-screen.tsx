"use client"

import { FormEvent, useState } from "react"
import { HardHat, ShieldCheck } from "lucide-react"

import { LoginRoleCard } from "@/components/molecules/login-role-card"

type LoginScreenProps = {
  technicians: string[]
  onLogin: (credentials: {
    role: "gestor" | "eletricista"
    name: string
    password: string
  }) => Promise<void>
}

export function LoginScreen({ technicians, onLogin }: LoginScreenProps) {
  const [managerName, setManagerName] = useState("Gestor Operacional")
  const [managerPassword, setManagerPassword] = useState("admin123")
  const [technicianName, setTechnicianName] = useState(technicians[0] ?? "")
  const [technicianPin, setTechnicianPin] = useState("1234")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleManagerLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await onLogin({
        role: "gestor",
        name: managerName.trim() || "Gestor",
        password: managerPassword,
      })
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Falha no login"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTechnicianLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await onLogin({
        role: "eletricista",
        name: technicianName,
        password: technicianPin,
      })
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Falha no login"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center gap-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-sm font-medium text-white">
            SGDE · Acesso ao sistema
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            Escolha o perfil para acessar as demandas.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            O gestor acompanha todos os eletricistas. O eletricista entra direto
            na agenda filtrada com seus próprios atendimentos.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <LoginRoleCard
            description="Visão completa do calendário, filtros, edição de horários e controle de status."
            icon={ShieldCheck}
            title="Gestor"
            onSubmit={handleManagerLogin}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Nome do gestor
              <input
                className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Senha
              <input
                className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={managerPassword}
                required
                type="password"
                onChange={(event) => setManagerPassword(event.target.value)}
              />
            </label>
          </LoginRoleCard>

          <LoginRoleCard
            description="Acesso direto às demandas do técnico, com agenda diária e atualização de status."
            icon={HardHat}
            title="Eletricista"
            onSubmit={handleTechnicianLogin}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Eletricista
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
                value={technicianName}
                onChange={(event) => setTechnicianName(event.target.value)}
              >
                {technicians.map((technician) => (
                  <option key={technician} value={technician}>
                    {technician}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              PIN de campo
              <input
                className="h-11 rounded-2xl border border-slate-200 px-4 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={technicianPin}
                inputMode="numeric"
                required
                type="password"
                onChange={(event) => setTechnicianPin(event.target.value)}
              />
            </label>
          </LoginRoleCard>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {isSubmitting ? (
          <div className="text-sm font-medium text-slate-600">Autenticando...</div>
        ) : null}
      </section>
    </main>
  )
}
