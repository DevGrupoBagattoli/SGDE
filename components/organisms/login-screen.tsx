"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import { Eye, EyeOff, HardHat, ShieldCheck } from "lucide-react"
import { z } from "zod"

import { LoginRoleCard } from "@/components/molecules/login-role-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoginInput, loginSchema } from "@/lib/schemas/login"

type LoginScreenProps = {
  technicians: { id: string; name: string }[]
  onLogin: (credentials: LoginInput) => Promise<void>
  isLoading?: boolean
  error?: string
}

export function LoginScreen({ technicians, onLogin, isLoading, error: externalError }: LoginScreenProps) {
  const [managerName, setManagerName] = useState("")
  const [managerPassword, setManagerPassword] = useState("")
  const [showManagerPassword, setShowManagerPassword] = useState(false)

  const [technicianName, setTechnicianName] = useState("")
  const [technicianPin, setTechnicianPin] = useState("")
  const [showTechnicianPin, setShowTechnicianPin] = useState(false)

  const [localError, setLocalError] = useState("")

  const handleManagerLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError("")

    try {
      const payload = loginSchema.parse({
        role: "gestor",
        name: managerName.trim() || "Gestor",
        password: managerPassword,
      })
      await onLogin(payload)
    } catch (err) {
      if (err instanceof z.ZodError) {
        setLocalError(err.issues[0].message)
      } else {
        setLocalError(err instanceof Error ? err.message : "Falha no login")
      }
    }
  }

  const handleTechnicianLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError("")

    try {
      const payload = loginSchema.parse({
        role: "eletricista",
        name: technicianName,
        password: technicianPin,
      })
      await onLogin(payload)
    } catch (err) {
      if (err instanceof z.ZodError) {
        setLocalError(err.issues[0].message)
      } else {
        setLocalError(err instanceof Error ? err.message : "Falha no login")
      }
    }
  }

  const displayError = localError || externalError

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
            <div className="grid gap-2">
              <Label htmlFor="manager-name">Nome do gestor</Label>
              <Input
                id="manager-name"
                required
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manager-password">Senha</Label>
              <div className="relative">
                <Input
                  id="manager-password"
                  required
                  type={showManagerPassword ? "text" : "password"}
                  value={managerPassword}
                  onChange={(event) => setManagerPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  onClick={() => setShowManagerPassword(!showManagerPassword)}
                  tabIndex={-1}
                >
                  {showManagerPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </LoginRoleCard>

          <LoginRoleCard
            description="Acesso direto às demandas do técnico, com agenda diária e atualização de status."
            icon={HardHat}
            title="Eletricista"
            onSubmit={handleTechnicianLogin}
          >
            <div className="grid gap-2">
              <Label htmlFor="technician-name">Eletricista</Label>
              <Select
                value={technicianName}
                onValueChange={setTechnicianName}
                required
              >
                <SelectTrigger id="technician-name">
                  <SelectValue placeholder="Selecione o eletricista" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.name}>
                      {technician.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="technician-pin">PIN de campo</Label>
              <div className="relative">
                <Input
                  id="technician-pin"
                  inputMode="numeric"
                  required
                  type={showTechnicianPin ? "text" : "password"}
                  value={technicianPin}
                  onChange={(event) => setTechnicianPin(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  onClick={() => setShowTechnicianPin(!showTechnicianPin)}
                  tabIndex={-1}
                >
                  {showTechnicianPin ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </LoginRoleCard>
        </div>

        {displayError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {displayError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-sm font-medium text-slate-600">Autenticando...</div>
        ) : null}

        <footer className="mt-10 flex flex-col items-center gap-2 border-t border-slate-200 pt-8 pb-2 sm:flex-row sm:justify-between sm:gap-4">
          <p className="text-center text-xs text-slate-500 sm:text-left">
            Solução desenvolvida por
          </p>
          <Image
            src="/bagattoli-tech-logo.png"
            alt="Bagattoli Tech"
            width={220}
            height={52}
            className="h-9 w-auto sm:h-10"
            priority
          />
        </footer>
      </section>
    </main>
  )
}
