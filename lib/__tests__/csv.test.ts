import { describe, expect, it } from "@jest/globals"

import { buildCsv, buildCsvRow, escapeCsvCell } from "@/lib/server/csv"

describe("escapeCsvCell", () => {
  it("envolve valor simples em aspas duplas", () => {
    expect(escapeCsvCell("abc")).toBe('"abc"')
  })

  it("duplica aspas duplas internas (RFC 4180)", () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"')
  })

  it("escapa fórmula com igual", () => {
    expect(escapeCsvCell("=cmd|'/c calc'!A1")).toBe('"\'=cmd|\'/c calc\'!A1"')
  })

  it("escapa fórmula com mais", () => {
    expect(escapeCsvCell("+1+1")).toBe('"\'+1+1"')
  })

  it("escapa fórmula com menos", () => {
    expect(escapeCsvCell("-1+1")).toBe('"\'-1+1"')
  })

  it("escapa fórmula com arroba", () => {
    expect(escapeCsvCell("@SUM(A1:A2)")).toBe('"\'@SUM(A1:A2)"')
  })

  it("escapa tab inicial", () => {
    expect(escapeCsvCell("\tcmd")).toBe('"\'\tcmd"')
  })

  it("escapa CR inicial", () => {
    expect(escapeCsvCell("\rcmd")).toBe('"\'\rcmd"')
  })

  it("não altera valor que não inicia com caractere de fórmula", () => {
    expect(escapeCsvCell("demanda normal")).toBe('"demanda normal"')
  })

  it("trata null e undefined como string vazia", () => {
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(undefined)).toBe('""')
  })

  it("trata número convertendo para string", () => {
    expect(escapeCsvCell(42)).toBe('"42"')
  })
})

describe("buildCsvRow", () => {
  it("une valores com vírgula aplicando escape", () => {
    expect(buildCsvRow(["a", "b", "c"])).toBe('"a","b","c"')
  })

  it("aplica escape em valores perigosos", () => {
    expect(buildCsvRow(["=evil", "safe"])).toBe('"\'=evil","safe"')
  })
})

describe("buildCsv", () => {
  it("monta cabeçalho + linhas com CRLF", () => {
    const csv = buildCsv(["A", "B"], [["1", "2"], ["3", "4"]])
    expect(csv).toBe('"A","B"\r\n"1","2"\r\n"3","4"')
  })

  it("protege células com fórmula maliciosa", () => {
    const csv = buildCsv(["Nome"], [['=HYPERLINK("http://mal")']])
    expect(csv).toContain("'=")
  })
})
