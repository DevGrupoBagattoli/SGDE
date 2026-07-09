/**
 * Helpers para exportação CSV (RFC 4180) com proteção contra
 * CSV Formula Injection (CWE-1236).
 *
 * Células que começam com caracteres interpretados como fórmula
 * por planilhas (Excel, LibreOffice Calc, Google Sheets) — `=`, `+`,
 * `-`, `@`, tab (U+0009) e CR (U+000D) — recebem o prefixo `'`
 * (single quote) antes do escape de aspas. O prefixo é exibido
 * literalmente na planilha e impede a execução da fórmula.
 *
 * Referência: https://owasp.org/www-community/attacks/CSV_Injection
 */

const FORMULA_PREFIXES = /^[+=@-]|\t|\r/

/**
 * Escapa um valor para célula CSV conforme RFC 4180 e neutraliza
 * tentativas de injeção de fórmula. O valor é sempre envolvido por
 * aspas duplas; aspas internas são duplicadas.
 */
export const escapeCsvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value)
  const safe = FORMULA_PREFIXES.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

/**
 * Monta uma linha CSV a partir de uma lista de valores, aplicando
 * `escapeCsvCell` em cada um e unindo com vírgula.
 */
export const buildCsvRow = (values: Array<string | number | null | undefined>): string =>
  values.map(escapeCsvCell).join(",")

/**
 * Monta o corpo completo de um CSV (cabeçalho + linhas) usando
 * terminador de linha CRLF (RFC 4180).
 */
export const buildCsv = (
  headers: Array<string>,
  rows: Array<Array<string | number | null | undefined>>
): string => {
  const lines = [buildCsvRow(headers), ...rows.map(buildCsvRow)]
  return lines.join("\r\n")
}
