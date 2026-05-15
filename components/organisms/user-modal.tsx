"use client"

import { FormEvent, useState } from "react"
import { Eye, EyeOff, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserDto } from "@/lib/api"
import {
  validateUserName,
  validateUserPassword,
} from "@/lib/users"

type UserModalProps = {
  user?: UserDto | null
  onClose: () => void
  onSave: (data: {
    name: string
    role: "gestor" | "eletricista"
    password?: string
  }) => Promise<void>
}

export function UserModal({ user, onClose, onSave }: UserModalProps) {
  const [name, setName] = useState(user?.name ?? "")
  const [role, setRole] = useState<"gestor" | "eletricista">(
    user?.role ?? "eletricista"
  )
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const trimmedName = name.trim()
      const nameError = validateUserName(trimmedName)
      if (nameError) {
        throw new Error(nameError)
      }

      const passwordError = validateUserPassword(password, {
        required: !user,
      })
      if (passwordError) {
        throw new Error(passwordError)
      }

      const payload: {
        name: string
        role: "gestor" | "eletricista"
        password?: string
      } = {
        name: trimmedName,
        role,
      }

      if (password) {
        payload.password = password
      }

      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuário")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {user ? "Editar usuário" : "Novo usuário"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {user
                ? "Atualize os dados do usuário abaixo."
                : "Preencha os dados para cadastrar um novo usuário."}
            </p>
          </div>
          <Button
            aria-label="Fechar modal"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name">Nome</Label>
            <Input
              id="user-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="user-role">Papel</Label>
            <Select
              value={role}
              onValueChange={(value: "gestor" | "eletricista") => setRole(value)}
              required
            >
              <SelectTrigger id="user-role">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eletricista">Eletricista</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="user-password">
              {user ? "Nova senha (opcional)" : "Senha"}
            </Label>
            <div className="relative">
              <Input
                id="user-password"
                className="pr-10"
                required={!user}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={user ? "Deixe em branco para manter" : "Senha de acesso"}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  )
}
