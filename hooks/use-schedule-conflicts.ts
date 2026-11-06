"use client"

import { useEffect, useState } from "react"

import { apiGetConflicts } from "@/lib/api"
import type { ScheduleConflictDto } from "@/lib/demands"

const DEBOUNCE_MS = 400
const SEPARATOR = "\u0000"

type UseScheduleConflictsParams = {
  enabled: boolean
  inicio: string
  duracao: string
  usuarios: string[]
  excluir?: string
}

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

    const controller = new AbortController()
    const timer = setTimeout(() => {
      apiGetConflicts(
        {
          inicio,
          duracao,
          usuarios: usuariosKey.split(SEPARATOR),
          excluir,
        },
        controller.signal
      )
        .then((conflicts) => {
          if (!controller.signal.aborted) setResult({ key, conflicts })
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, conflicts: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [key, inicio, duracao, usuariosKey, excluir])

  const isCurrent = key !== null && result.key === key

  return {
    conflicts: isCurrent ? result.conflicts : [],
    isChecking: key !== null && !isCurrent,
  }
}
