import type { CsvImportError } from '@student-shared'
import type { CsvRow } from '../../validations/csvRowSchema'

export interface ParseResult {
  data: CsvRow[]
  errors: CsvImportError[]
}

export interface ParsedRow {
  data: Record<string, string>
  line: number
}

export interface ParsedCsv {
  headers: string[]
  rows: ParsedRow[]
  structuralErrors: CsvImportError[]
}

export interface RowValidationResult {
  validRows: CsvRow[]
  errors: CsvImportError[]
}
