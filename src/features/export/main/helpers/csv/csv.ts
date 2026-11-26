import {
  CSV_BOM,
  CSV_EOL,
  CSV_FORMULA_GUARD,
  CSV_QUOTE,
  CSV_QUOTING_CHARACTERS,
  CSV_SEPARATOR,
  FORMULA_LEADING_CHARACTERS,
  FORMULA_SKIPPED_WHITESPACE,
  FORMULA_TRIGGER_CHARACTERS
} from './csvConstants'

const firstSignificantCharacter = (cell: string): string => {
  for (const character of cell) {
    if (!FORMULA_SKIPPED_WHITESPACE.includes(character)) {
      return character
    }
  }
  return ''
}

/**
 * Prefixes the whole cell with a single quote when a spreadsheet could read it as a formula:
 * first character is TAB or CR, or the first non-whitespace character is = + - or @.
 * Design choice: negative numbers are prefixed too ('-12), because a leading minus is a formula trigger.
 * Callers must stringify values (numbers, dates) before escaping; this only handles strings.
 */
export const neutralizeFormula = (cell: string): string => {
  const isTrigger =
    FORMULA_TRIGGER_CHARACTERS.includes(cell.charAt(0)) ||
    FORMULA_LEADING_CHARACTERS.includes(firstSignificantCharacter(cell))
  return isTrigger ? `${CSV_FORMULA_GUARD}${cell}` : cell
}

const needsQuoting = (cell: string): boolean =>
  CSV_QUOTING_CHARACTERS.some((character) => cell.includes(character))

export const escapeCsvCell = (cell: string): string => {
  const safe = neutralizeFormula(cell)
  if (!needsQuoting(safe)) {
    return safe
  }
  return `${CSV_QUOTE}${safe.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`
}

/** An empty cell list yields a bare CRLF line. */
export const serializeCsvRow = (cells: readonly string[]): string =>
  `${cells.map(escapeCsvCell).join(CSV_SEPARATOR)}${CSV_EOL}`

export const serializeCsvRows = (rows: readonly (readonly string[])[]): string =>
  rows.map(serializeCsvRow).join('')

export const serializeCsvHeader = (header: readonly string[]): string =>
  `${CSV_BOM}${serializeCsvRow(header)}`
