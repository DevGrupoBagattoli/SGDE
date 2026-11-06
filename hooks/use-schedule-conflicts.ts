"use client"

import { useEffect, useState } from "react"

import { apiGetConflicts } from "@/lib/api"
import type { ScheduleConflictDto } from "@/lib/demands"

const DEBOUNCE_MS = 400
const SEPARATOR = "\u0000"

type UseScheduleConflictsParams = {
  /** Desligado quando falta dado, o chamado não ocupa ninguém ou nada relevante mudou. */
  enabled: boolean
  inicio: string
  duracao: string
  usuarios: string[]
  excluir?: string
}

/**
 * Avisa antes de salvar quem já está ocupado no horário. Espera o usuário parar de
 * mexer (debounce) e descarta respostas de consultas que já ficaram para trás.
 * Falha de rede não bloqueia nada: o 409 do salvamento é a garantia.
 */
export function useScheduleConflicts({
  enabled,
  inicio,
  duracao,
  usuarios,
  excluir,
}: UseScheduleConflictsParams) {
  const [result, setResult] = useState<{ key: string; conflicts: ScheduleConflictDto[] }>({
    key: "",
    conflicts: [],
  })

  const usuariosKey = [...usuarios].sort().join(SEPARATOR)
  const key = enabled && inicio && usuariosKey
    ? [inicio, duracao, usuariosKey, excluir ?? ""].join(SEPARATOR)
    : null

  useEffect(() => {
    if (!key) return

    let cancelled = false
    const timer = setTimeout(() => {
      apiGetConflicts({
        inicio,
        duracao,
        usuarios: usuariosKey.split(SEPARATOR),
        excluir,
      })
        .then((conflicts) => {
          if (!cancelled) setResult({ key, conflicts })
        })
        .catch(() => {
          if (!cancelled) setResult({ key, conflicts: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key, inicio, duracao, usuariosKey, excluir])

  const isCurrent = key !== null && result.key === key

  return {
    conflicts: isCurrent ? result.conflicts : [],
    isChecking: key !== null && !isCurrent,
  }
}
