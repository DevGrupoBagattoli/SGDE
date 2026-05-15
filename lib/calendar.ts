export const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
})

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

export const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
})

export const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
})

/** Valor para `input[type=datetime-local]`: componentes de data/hora no fuso local do instante ISO. */
export const toDateTimeLocalValue = (isoDate: string) => {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${mo}-${day}T${h}:${min}`
}

export const getDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

const startOfLocalDay = (instant: Date) =>
  new Date(instant.getFullYear(), instant.getMonth(), instant.getDate())

/** Dias civis locais entre início e fim (inclusive), alinhado ao calendário da UI. */
export const enumerateDateKeysLocal = (start: Date, end: Date) => {
  const keys: string[] = []
  const current = startOfLocalDay(start)
  const last = startOfLocalDay(end)

  if (current.getTime() > last.getTime()) {
    return [getDateKey(startOfLocalDay(start))]
  }

  while (current.getTime() <= last.getTime()) {
    keys.push(getDateKey(current))
    current.setDate(current.getDate() + 1)
  }

  return keys
}

export const buildCalendarDays = (month: Date) => {
  const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const calendarStart = new Date(firstDayOfMonth)
  calendarStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)

    return {
      date,
      dateKey: getDateKey(date),
      isCurrentMonth: date.getMonth() === month.getMonth(),
    }
  })
}
