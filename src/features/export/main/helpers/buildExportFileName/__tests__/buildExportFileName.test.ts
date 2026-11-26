import { describe, expect, it } from 'vitest'

import { EXPORT_KINDS } from '@export-shared'

import { buildExportFileName, sanitizeFileName } from '..'

const TODAY = '2026-11-25'
const PERIOD = { startDate: '2026-09-01', endDate: '2026-09-30' }
const WINDOWS_FORBIDDEN = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
const FIRST_PRINTABLE_CODE = 32
const LONG_NAME_LENGTH = 500
const MAX_BYTES = 200
const DELETE_CODE = 127
const textEncoder = new TextEncoder()
const byteLength = (name: string): number => textEncoder.encode(name).length

const hasForbiddenCharacter = (name: string): boolean =>
  [...name].some(
    (character) =>
      WINDOWS_FORBIDDEN.includes(character) || character.charCodeAt(0) < FIRST_PRINTABLE_CODE
  )

describe('buildExportFileName', () => {
  it('journal with period → mon-cdi-journal-2026-09-01_2026-09-30.csv', () => {
    expect(buildExportFileName({ kind: 'journal', period: PERIOD, today: TODAY })).toBe(
      'mon-cdi-journal-2026-09-01_2026-09-30.csv'
    )
  })

  it.each([
    ['visitsByDay', 'mon-cdi-visites-par-jour-2026-09-01_2026-09-30.csv'],
    ['visitsByActivity', 'mon-cdi-visites-par-activite-2026-09-01_2026-09-30.csv'],
    ['visitsByClass', 'mon-cdi-visites-par-classe-2026-09-01_2026-09-30.csv']
  ] as const)('%s uses its slug and the period', (kind, expected) => {
    expect(buildExportFileName({ kind, period: PERIOD, today: TODAY })).toBe(expected)
  })

  it('students → mon-cdi-eleves-2026-11-25.csv (uses today, ignores period)', () => {
    expect(buildExportFileName({ kind: 'students', period: PERIOD, today: TODAY })).toBe(
      'mon-cdi-eleves-2026-11-25.csv'
    )
  })

  it('falls back to today when a period kind has no period', () => {
    expect(buildExportFileName({ kind: 'journal', today: TODAY })).toBe(
      'mon-cdi-journal-2026-11-25.csv'
    )
  })

  it('single-day period still has start_end', () => {
    const period = { startDate: '2026-09-15', endDate: '2026-09-15' }
    expect(buildExportFileName({ kind: 'journal', period, today: TODAY })).toBe(
      'mon-cdi-journal-2026-09-15_2026-09-15.csv'
    )
  })

  it('result never contains a Windows-forbidden character, whatever the kind', () => {
    for (const kind of EXPORT_KINDS) {
      expect(
        hasForbiddenCharacter(buildExportFileName({ kind, period: PERIOD, today: TODAY }))
      ).toBe(false)
    }
  })

  it('sanitizes hostile date parts', () => {
    const period = { startDate: '..\\evil:1', endDate: '2026/09/30' }
    const name = buildExportFileName({ kind: 'journal', period, today: TODAY })
    expect(hasForbiddenCharacter(name)).toBe(false)
    expect(name.endsWith('.csv')).toBe(true)
  })
})

describe('sanitizeFileName', () => {
  it.each([...WINDOWS_FORBIDDEN, '\u0000', '\u0007', '\n', '\r', '\t', '\u001f'])(
    "replaces %j with '-'",
    (character) => {
      expect(sanitizeFileName(`a${character}b.csv`)).toBe('a-b.csv')
    }
  )

  it('trailing dot or space is trimmed', () => {
    expect(sanitizeFileName('rapport. . ')).toBe('rapport')
    expect(sanitizeFileName('rapport...')).toBe('rapport')
  })

  it('keeps accents and ordinary characters', () => {
    expect(sanitizeFileName('élèves-2026.csv')).toBe('élèves-2026.csv')
  })

  it.each([
    ['CON', '_CON'],
    ['CON.', '_CON'],
    ['nul.csv', '_nul.csv'],
    ['COM1.txt', '_COM1.txt'],
    ['lpt9', '_lpt9'],
    ['Aux.csv', '_Aux.csv'],
    ['nul .txt', '_nul .txt'],
    ['COM\u00b9', '_COM\u00b9'],
    ['com\u00b2.csv', '_com\u00b2.csv'],
    ['LPT\u00b3.txt', '_LPT\u00b3.txt'],
    ['CONIN$', '_CONIN$'],
    ['conout$.csv', '_conout$.csv']
  ])('defuses the reserved Windows device name %j as %j', (name, expected) => {
    expect(sanitizeFileName(name)).toBe(expected)
  })

  it('replaces the DEL control character', () => {
    expect(sanitizeFileName(`a${String.fromCharCode(DELETE_CODE)}b.csv`)).toBe('a-b.csv')
  })

  it('does not alter names that merely start like a reserved name', () => {
    expect(sanitizeFileName('console.csv')).toBe('console.csv')
  })

  it('falls back to a default name when nothing is left', () => {
    expect(sanitizeFileName('...')).toBe('export')
    expect(sanitizeFileName('')).toBe('export')
  })

  it('caps the length while keeping the extension', () => {
    const result = sanitizeFileName(`${'a'.repeat(LONG_NAME_LENGTH)}.csv`)
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_BYTES)
    expect(result.endsWith('.csv')).toBe(true)
  })

  it('caps a name without extension', () => {
    expect(sanitizeFileName('a'.repeat(LONG_NAME_LENGTH))).toBe('a'.repeat(MAX_BYTES))
  })

  it('caps by UTF-8 bytes, not by characters', () => {
    const result = sanitizeFileName(`${'\u00e9'.repeat(LONG_NAME_LENGTH)}.csv`)
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_BYTES)
    expect(result.endsWith('.csv')).toBe(true)
    expect(result.startsWith('\u00e9')).toBe(true)
  })

  it('never cuts a surrogate pair in half', () => {
    const result = sanitizeFileName(`${'\u{1F600}'.repeat(LONG_NAME_LENGTH)}.csv`)
    expect(result.isWellFormed()).toBe(true)
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_BYTES)
    expect(result.endsWith('.csv')).toBe(true)
  })

  it('stays within the cap when the extension alone is longer than the cap', () => {
    const result = sanitizeFileName(`a.${'b'.repeat(LONG_NAME_LENGTH)}`)
    expect(result.length).toBeGreaterThan(0)
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_BYTES)
  })
})
