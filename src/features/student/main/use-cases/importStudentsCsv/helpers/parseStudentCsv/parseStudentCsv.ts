import Papa from 'papaparse'
import { csvRowSchema } from '../../validations/csvRowSchema'
import { CSV_REQUIRED_COLUMNS, UTF8_BOM_CHARACTER, HEADER_ALIASES } from '../csvConstants'
import type { CsvImportError, CsvRowIssue } from '@student-shared'
import type { CsvRow } from '../../validations/csvRowSchema'
import type {
  ParseResult,
  ParsedCsv,
  ParsedRow,
  RowValidationResult
} from './parseStudentCsv.types'

const PAPA_QUOTES_ERROR_TYPE = 'Quotes'
const PAPA_FIELD_MISMATCH_ERROR_TYPE = 'FieldMismatch'
const PAPA_DELIMITER_ERROR_TYPE = 'Delimiter'
const CSV_ERROR_FIELD = 'csv'
const INVALID_QUOTES_CODE = 'invalid_quotes'
const INVALID_FIELD_COUNT_CODE = 'invalid_field_count'
const INVALID_CSV_CODE = 'invalid_csv'
const HEADER_LINE_NUMBER = 1
const NEWLINE = '\n'

const NORMALISED_REQUIRED_COLUMNS = CSV_REQUIRED_COLUMNS.map(normaliseHeader)

function stripBom(text: string): string {
  if (text.charCodeAt(0) === UTF8_BOM_CHARACTER) {
    return text.slice(1)
  }
  return text
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().normalize('NFC')
}

function resolveHeaderAlias(normalised: string): string {
  return HEADER_ALIASES[normalised] ?? normalised
}

function countNewlines(text: string): number {
  return text.split(NEWLINE).length - 1
}

// Physical line (1-based) on which the record that Papa just emitted ends. The cursor sits
// after the record's line break, which is trimmed so blank lines skipped by Papa are counted.
function lineOfRecordEnd(text: string, cursor: number): number {
  return countNewlines(text.slice(0, cursor).trimEnd()) + HEADER_LINE_NUMBER
}

function lineOfIndex(text: string, index: number): number {
  return countNewlines(text.slice(0, index)) + HEADER_LINE_NUMBER
}

function toCsvErrorCode(type: string): string {
  if (type === PAPA_QUOTES_ERROR_TYPE) {
    return INVALID_QUOTES_CODE
  }
  if (type === PAPA_FIELD_MISMATCH_ERROR_TYPE) {
    return INVALID_FIELD_COUNT_CODE
  }
  return INVALID_CSV_CODE
}

function toStructuralError(code: string, rowNumber: number): CsvImportError {
  return { type: 'ROW_VALIDATION', rowNumber, issues: [{ field: CSV_ERROR_FIELD, code }] }
}

// Every row-level Papa error (unterminated quote, too many / too few fields...) makes the file
// unreliable: the offending row is never imported and the error is reported, which also blocks
// the "remove absent students" mode. The only ignored type is 'Delimiter' (undetectable
// delimiter, e.g. a header-only file): a file whose delimiter really is wrong ends up with a
// single header column and is rejected by the header validation (MISSING_COLUMNS) anyway.
function parseCsvText(text: string): ParsedCsv {
  const rows: ParsedRow[] = []
  const structuralErrors: CsvImportError[] = []
  const transformHeader = (header: string): string => resolveHeaderAlias(normaliseHeader(header))
  // step mode never reports the header of a file without data rows, so read it separately
  const headers =
    Papa.parse<Record<string, string>>(text, { header: true, preview: 1, transformHeader }).meta
      .fields ?? []

  Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader,
    step: (results) => {
      const line = lineOfRecordEnd(text, results.meta.cursor)
      const blocking = results.errors.filter((error) => error.type !== PAPA_DELIMITER_ERROR_TYPE)
      const quoteError = blocking.find((error) => error.type === PAPA_QUOTES_ERROR_TYPE)
      if (quoteError !== undefined) {
        const quoteLine =
          quoteError.index === undefined ? line : lineOfIndex(text, quoteError.index)
        structuralErrors.push(toStructuralError(INVALID_QUOTES_CODE, quoteLine))
        return
      }
      const [firstError] = blocking
      if (firstError !== undefined) {
        structuralErrors.push(toStructuralError(toCsvErrorCode(firstError.type), line))
        return
      }
      rows.push({ data: results.data, line })
    }
  })

  return { headers, rows, structuralErrors }
}

function validateHeaders(headers: string[]): CsvImportError | null {
  const missingColumns = NORMALISED_REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
  if (missingColumns.length > 0) {
    return { type: 'MISSING_COLUMNS', columns: missingColumns }
  }
  return null
}

function buildRowIssues(
  errorIssues: Array<{ path: (string | number)[]; code: string }>
): CsvRowIssue[] {
  return errorIssues.map((issue) => ({
    field: String(issue.path[0]),
    code: issue.code
  }))
}

function validateRows(rows: ParsedRow[]): RowValidationResult {
  const validRows: CsvRow[] = []
  const errors: CsvImportError[] = []

  for (const row of rows) {
    const result = csvRowSchema.safeParse(row.data)
    if (result.success) {
      validRows.push(result.data)
    } else {
      const rowNumber = row.line
      const issues = buildRowIssues(result.error.issues)
      errors.push({ type: 'ROW_VALIDATION', rowNumber, issues })
    }
  }

  return { validRows, errors }
}

export function parseStudentCsv(rawCsvText: string): ParseResult {
  const cleanText = stripBom(rawCsvText)
  const { headers, rows, structuralErrors } = parseCsvText(cleanText)

  const headerError = validateHeaders(headers)
  if (headerError) {
    return { data: [], errors: [headerError] }
  }

  const { validRows, errors } = validateRows(rows)
  return { data: validRows, errors: [...structuralErrors, ...errors] }
}
