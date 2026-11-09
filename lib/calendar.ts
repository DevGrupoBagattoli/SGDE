import {
  appTimeFormatter,
  createAppFormatter,
  calendarDateOfInstantInAppTz,
  enumerateDateKeysInAppTz,
  fromAppDateTimeInputValue,
  toAppDateTimeInputValue,
  todayCalendarDateInAppTz,
} from "@/lib/timezone"

export const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
})

/*
 * Dois tipos de Date circulam na tela:
 * - instantes (horarioInicio/horarioFim vindos da API): sempre formatados e
 *   convertidos no fuso da empresa (lib/timezone), não no fuso do celular;
 * - datas de calendário (mês exibido, dia selecionado, células do calendário):
 *   meia-noite local, lidas só por getFullYear/getMonth/getDate.
 */

/** Formata o dia de um INSTANTE no fuso da empresa (ex.: "qua., 04/11"). */
export const dateFormatter = createAppFormatter("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

/** Formata uma DATA DE CALENDÁRIO (meia-noite local). */
export const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
})

/** Formata o horário de um INSTANTE no fuso da empresa. */
export const timeFormatter = appTimeFormatter

/** Valor para `input[type=datetime-local]`: data/hora do instante no fuso da empresa. */
export const toDateTimeLocalValue = toAppDateTimeInputValue

/** Converte o valor de `input[type=datetime-local]` (fuso da empresa) para ISO UTC. */
export const fromDateTimeLocalValue = fromAppDateTimeInputValue

/** Chave "YYYY-MM-DD" de uma DATA DE CALENDÁRIO. */
export const getDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

/** Dias civis (fuso da empresa) entre dois INSTANTES, inclusive. */
export const enumerateDateKeys = enumerateDateKeysInAppTz

/** "Hoje" no fuso da empresa, como data de calendário. */
export const todayCalendarDate = () => todayCalendarDateInAppTz()

/** Data de calendário do dia de um INSTANTE no fuso da empresa. */
export const calendarDateOfInstant = calendarDateOfInstantInAppTz

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
