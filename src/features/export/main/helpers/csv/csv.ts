import {
  CSV_BOM,
  CSV_EOL,
  CSV_FORMULA_GUARD,
  CSV_QUOTE,
  CSV_QUOTING_CHARACTERS,
  CSV_SEPARATOR,
  FORMULA_TRIGGER_CHARACTERS
} from './csvConstants'

export const neutralizeFormula = (cell: string): string =>
  FORMULA_TRIGGER_CHARACTERS.includes(cell.charAt(0)) ? `${CSV_FORMULA_GUARD}${cell}` : cell

const needsQuoting = (cell: string): boolean =>
  CSV_QUOTING_CHARACTERS.some((character) => cell.includes(character))

export const escapeCsvCell = (cell: string): string => {
  const safe = neutralizeFormula(cell)
  if (!needsQuoting(safe)) {
    return safe
  }
  return `${CSV_QUOTE}${safe.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`
}

export const serializeCsvRow = (cells: readonly string[]): string =>
  `${cells.map(escapeCsvCell).join(CSV_SEPARATOR)}${CSV_EOL}`

export const serializeCsvRows = (rows: readonly (readonly string[])[]): string =>
  rows.map(serializeCsvRow).join('')

export const serializeCsvHeader = (header: readonly string[]): string =>
  `${CSV_BOM}${serializeCsvRow(header)}`
