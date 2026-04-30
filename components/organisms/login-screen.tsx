"use client"

import { FormEvent, useState } from "react"
import { HardHat, ShieldCheck } from "lucide-react"

import { LoginRoleCard } from "@/components/molecules/login-role-card"
import { UserSession } from "@/lib/auth"

type LoginScreenProps = {
  technicians: string[]
  onLogin: (session: UserSession) => void
}

export function LoginScreen({ technicians, onLogin }: LoginScreenProps) {
  const [managerName, setManagerName] = useState("Gestor Operacional")
  const [technicianName, setTechnicianName] = useState(technicians[0] ?? "")

  const handleManagerLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // TODO: Integrar com API POST de autenticação do gestor.
    onLogin({ name: managerName.trim() || "Gestor", role: "gestor" })
  }

  const handleTechnicianLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // TODO: Integrar com API POST de autenticação do eletricista.
    onLogin({ name: technicianName, role: "eletricista" })
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
                defaultValue="admin123"
                required
                type="password"
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
                defaultValue="1234"
                inputMode="numeric"
                required
                type="password"
              />
            </label>
          </LoginRoleCard>
        </div>
      </section>
    </main>
  )
}
