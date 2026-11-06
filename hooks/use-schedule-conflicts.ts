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
  const [conflicts, setConflicts] = useState<ScheduleConflictDto[]>([])

  const usuariosKey = [...usuarios].sort().join(SEPARATOR)
  const key = enabled && inicio && usuariosKey
    ? [inicio, duracao, usuariosKey, excluir ?? ""].join(SEPARATOR)
    : null

  const [previousKey, setPreviousKey] = useState(key)

  if (previousKey !== key) {
    setPreviousKey(key)
    if (key === null) setConflicts([])
  }

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
        .then((found) => {
          if (!controller.signal.aborted) setConflicts(found)
        })
        .catch(() => {
          if (!controller.signal.aborted) setConflicts([])
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [key, inicio, duracao, usuariosKey, excluir])

  return { conflicts }
}
