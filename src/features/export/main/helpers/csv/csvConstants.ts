export const CSV_BOM = '﻿'
export const CSV_SEPARATOR = ';'
export const CSV_EOL = '\r\n'
export const CSV_QUOTE = '"'
export const CSV_FORMULA_GUARD = "'"
export const FORMULA_LEADING_CHARACTERS: readonly string[] = ['=', '+', '-', '@']
export const FORMULA_SKIPPED_WHITESPACE: readonly string[] = [
  ' ',
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
  '\u2004',
  '\u2005',
  '\u2006',
  '\u2007',
  '\u2008',
  '\u2009',
  '\u200A',
  '\u202F',
  '\u205F',
  '\u3000',
  '\uFEFF',
  '\u200B',
  '\u200C',
  '\u200D',
  '\u2060'
]
export const FORMULA_TRIGGER_CHARACTERS: readonly string[] = ['=', '+', '-', '@', '\t', '\r']
export const CSV_QUOTING_CHARACTERS: readonly string[] = [CSV_SEPARATOR, CSV_QUOTE, '\r', '\n']
