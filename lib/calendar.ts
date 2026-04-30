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

export const toDateTimeLocalValue = (isoDate: string) => isoDate.slice(0, 16)

export const getDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

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
