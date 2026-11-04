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
