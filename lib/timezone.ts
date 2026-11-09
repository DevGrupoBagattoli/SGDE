/**
 * Fuso horário da empresa (Vilhena/RO — UTC-4, sem horário de verão).
 *
 * O banco guarda instantes em UTC. Toda conversão entre instante e
 * "data/hora de parede" (exibição, campos de formulário, agrupamento por dia,
 * relatórios, CSV, notificações) passa por este módulo, para que o resultado
 * não dependa do fuso do servidor nem do celular de quem está usando.
 *
 * Configurável por NEXT_PUBLIC_APP_TIMEZONE (lido no build, vale para tela e
 * servidor). Sem a variável, usa America/Porto_Velho.
 */

export const DEFAULT_APP_TIME_ZONE = "America/Porto_Velho"

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone })
    return true
  } catch {
    return false
  }
}

const resolveAppTimeZone = (): string => {
  const configured = process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim()
  if (!configured) return DEFAULT_APP_TIME_ZONE
  if (isValidTimeZone(configured)) return configured
  console.warn(
    `[timezone] NEXT_PUBLIC_APP_TIMEZONE inválido ("${configured}"); usando ${DEFAULT_APP_TIME_ZONE}`
  )
  return DEFAULT_APP_TIME_ZONE
}

export const APP_TIME_ZONE = resolveAppTimeZone()

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * Deslocamento fixo usado SÓ quando o navegador não sabe resolver o fuso pelo
 * Intl (WebView antigo com ICU reduzido não conhece "America/Porto_Velho" e
 * lança RangeError). Vilhena/RO é UTC-4 o ano todo (sem horário de verão).
 */
const FALLBACK_OFFSET_MS = -4 * 60 * 60 * 1000

/** Cria o formatter no fuso da empresa; null (nunca lança) se o navegador não suportar. */
const tryZonedFormatter = (
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat | null => {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIME_ZONE })
  } catch {
    return null
  }
}

/**
 * Formatter de instantes no fuso da empresa que nunca derruba a tela: se o
 * navegador não suportar o fuso, desloca o instante pelo UTC-4 fixo e formata
 * como UTC (suportado por todo Intl).
 */
export const createAppFormatter = (
  locale: string,
  options: Intl.DateTimeFormatOptions
): { format: (date: Date) => string } => {
  const zoned = tryZonedFormatter(locale, options)
  if (zoned) return zoned

  let shifted: Intl.DateTimeFormat | null = null
  try {
    shifted = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" })
  } catch {
    shifted = null
  }
  return {
    format: (date) =>
      shifted
        ? shifted.format(new Date(date.getTime() + FALLBACK_OFFSET_MS))
        : formatAppDateTime(date),
  }
}

const PARTS_FORMATTER = tryZonedFormatter("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

export type ZonedParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

/** Componentes de data/hora do instante no fuso da empresa. */
export const getZonedParts = (date: Date): ZonedParts => {
  if (!PARTS_FORMATTER || typeof PARTS_FORMATTER.formatToParts !== "function") {
    const shifted = new Date(date.getTime() + FALLBACK_OFFSET_MS)
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    }
  }
  const parts: Record<string, number> = {}
  for (const part of PARTS_FORMATTER.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

const offsetMsAt = (instantMs: number): number => {
  const p = getZonedParts(new Date(instantMs))
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instantMs / 1000) * 1000
}

/** Instante correspondente a uma data/hora de parede no fuso da empresa. */
export const zonedWallTimeToDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date => {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const firstGuess = wallAsUtc - offsetMsAt(wallAsUtc)
  const result = wallAsUtc - offsetMsAt(firstGuess)

  // Hora que não existe (relógio adiantado no início do horário de verão, ex.:
  // America/Santiago pula de 24:00 para 01:00): o segundo passo voltaria para o
  // dia anterior. Nesse caso usa o primeiro palpite, o primeiro instante depois
  // do salto, como faz o navegador. Sem efeito em fusos sem horário de verão.
  const p = getZonedParts(new Date(result))
  const matches =
    p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute
  return new Date(matches ? result : firstGuess)
}

/** "YYYY-MM-DD" do dia civil do instante no fuso da empresa. */
export const dateKeyInAppTz = (date: Date): string => {
  const p = getZonedParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

const parseDateKey = (dateKey: string): [number, number, number] | null => {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Início (00:00:00.000) do dia "YYYY-MM-DD" no fuso da empresa. */
export const startOfDayInAppTz = (dateKey: string): Date => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) throw new Error(`Data inválida: ${dateKey}`)
  return zonedWallTimeToDate(parsed[0], parsed[1], parsed[2])
}

/** Fim (23:59:59.999) do dia "YYYY-MM-DD" no fuso da empresa. */
export const endOfDayInAppTz = (dateKey: string): Date => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) throw new Error(`Data inválida: ${dateKey}`)
  return zonedWallTimeToDate(parsed[0], parsed[1], parsed[2], 23, 59, 59, 999)
}

const nextDateKey = (dateKey: string): string => {
  const [y, m, d] = parseDateKey(dateKey)!
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

/** Dias civis (fuso da empresa) cobertos pelo intervalo de instantes, inclusive. */
export const enumerateDateKeysInAppTz = (start: Date, end: Date): string[] => {
  const first = dateKeyInAppTz(start)
  const last = dateKeyInAppTz(end)
  if (first > last) return [first]

  const keys: string[] = []
  for (let key = first; key <= last; key = nextDateKey(key)) {
    keys.push(key)
  }
  return keys
}

/** Valor "YYYY-MM-DDTHH:mm" (input datetime-local) do instante no fuso da empresa. */
export const toAppDateTimeInputValue = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ""
  const p = getZonedParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Converte "YYYY-MM-DDTHH:mm" digitado (fuso da empresa) para ISO UTC. */
export const fromAppDateTimeInputValue = (value: string): string => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) throw new Error("Data e hora inválidas")
  const [, y, mo, d, h, mi] = match.map(Number)
  return zonedWallTimeToDate(y, mo, d, h, mi).toISOString()
}

/**
 * "Hoje" no fuso da empresa, como data de calendário (meia-noite local do
 * navegador). Datas de calendário só são lidas por getFullYear/getMonth/getDate.
 */
export const todayCalendarDateInAppTz = (now = new Date()): Date => {
  const p = getZonedParts(now)
  return new Date(p.year, p.month - 1, p.day)
}

/** Data de calendário (meia-noite local) do dia do instante no fuso da empresa. */
export const calendarDateOfInstantInAppTz = (date: Date): Date =>
  todayCalendarDateInAppTz(date)

export const appTimeFormatter = createAppFormatter("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
})

export const appDateFormatter = createAppFormatter("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/** "dd/MM/yyyy HH:mm" no fuso da empresa. Formato único de data e hora (tela, CSV, auditoria). */
export const formatAppDateTime = (date: Date): string => {
  const p = getZonedParts(date)
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`
}
