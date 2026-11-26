import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'

import {
  CSV_BOM,
  CSV_EOL,
  CSV_SEPARATOR,
  escapeCsvCell,
  neutralizeFormula,
  serializeCsvHeader,
  serializeCsvRow,
  serializeCsvRows
} from '..'

const GUARD = "'"

const parseBack = (text: string): string[][] =>
  Papa.parse<string[]>(text, { delimiter: CSV_SEPARATOR }).data.filter(
    (row) => row.length > 1 || row[0] !== ''
  )

describe('csv constants', () => {
  it('uses semicolon, CRLF and a BOM', () => {
    expect(CSV_SEPARATOR).toBe(';')
    expect(CSV_EOL).toBe('\r\n')
    expect(CSV_BOM).toBe('﻿')
  })
})

describe('serializeCsvHeader / serializeCsvRows', () => {
  it('header starts with the BOM exactly once and rows do not', () => {
    const header = serializeCsvHeader(['a', 'b'])
    expect(header.startsWith(CSV_BOM)).toBe(true)
    expect(header.slice(1).includes(CSV_BOM)).toBe(false)
    expect(serializeCsvRows([['a', 'b']]).includes(CSV_BOM)).toBe(false)
    expect(serializeCsvRow(['a', 'b']).includes(CSV_BOM)).toBe(false)
  })

  it('rows end with CRLF and never a bare LF between records', () => {
    const text = serializeCsvRows([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(text).toBe('a;b\r\nc;d\r\n')
    expect(/(?<!\r)\n/.test(text)).toBe(false)
  })

  it('empty rows array gives an empty string', () => {
    expect(serializeCsvRows([])).toBe('')
  })
})

describe('escapeCsvCell quoting', () => {
  it('quotes a cell with a semicolon', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"')
  })

  it('doubles quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes and preserves LF and CRLF inside a cell', () => {
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"')
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"')
  })

  it('does not quote plain or accented cells', () => {
    expect(escapeCsvCell('plain')).toBe('plain')
    expect(escapeCsvCell('Éloïse')).toBe('Éloïse')
  })

  it('keeps an empty cell empty', () => {
    expect(escapeCsvCell('')).toBe('')
  })
})

describe('formula guard', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"],
    ['\tx', "'\tx"],
    ['\rx', '"\'\rx"']
  ])('neutralizes %j', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected)
    expect(
      escapeCsvCell(input).startsWith(GUARD) || escapeCsvCell(input).startsWith(`"${GUARD}`)
    ).toBe(true)
  })

  it('neutralizeFormula prefixes only trigger-leading cells', () => {
    expect(neutralizeFormula('=1')).toBe("'=1")
    expect(neutralizeFormula('abc')).toBe('abc')
    expect(neutralizeFormula('')).toBe('')
  })

  it('applies to every column including INE and name', () => {
    expect(serializeCsvRow(['2026-01-05', '=1+1', '@x', '-12'])).toBe(
      "2026-01-05;'=1+1;'@x;'-12\r\n"
    )
  })

  it('only the first character matters', () => {
    for (const cell of ['3-B', 'Jean-Pierre', 'a=b', 'x@y', '1+1']) {
      expect(escapeCsvCell(cell)).toBe(cell)
    }
  })

  it('leaves a leading-space cell unchanged (documented limitation)', () => {
    expect(escapeCsvCell(' =1')).toBe(' =1')
  })

  it('guarded cell that also needs quoting', () => {
    expect(escapeCsvCell('=a;b')).toBe('"\'=a;b"')
  })
})

describe('round trip', () => {
  it('parses back to the same values except the guard prefix', () => {
    const cells = ['=cmd|x', 'O"Brien;Jr', 'multi\r\nline', '3-B', '']
    const parsed = parseBack(serializeCsvRow(cells))
    expect(parsed).toEqual([[`${GUARD}=cmd|x`, 'O"Brien;Jr', 'multi\r\nline', '3-B', '']])
  })

  it('round trips header and several rows', () => {
    const text =
      serializeCsvHeader(['h1', 'h2']) +
      serializeCsvRows([
        ['a;b', 'c'],
        ['-1', 'd']
      ])
    expect(parseBack(text.slice(1))).toEqual([
      ['h1', 'h2'],
      ['a;b', 'c'],
      [`${GUARD}-1`, 'd']
    ])
  })
})
