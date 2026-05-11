export const parseDurationMinutes = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})h$/)

  if (!match) {
    throw new Error("Duração inválida. Use o formato HH:MMh")
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (minutes > 59) {
    throw new Error("Minutos inválidos na duração")
  }

  return hours * 60 + minutes
}

export const formatDurationMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const hoursPart = String(Math.floor(safeMinutes / 60)).padStart(2, "0")
  const minutesPart = String(safeMinutes % 60).padStart(2, "0")
  return `${hoursPart}:${minutesPart}h`
}

export const clampDayStart = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))

export const clampDayEnd = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))

export const enumerateDateKeysUtc = (start: Date, end: Date) => {
  const keys: string[] = []
  const current = clampDayStart(start)
  const last = clampDayStart(end)

  while (current.getTime() <= last.getTime()) {
    keys.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return keys
}
