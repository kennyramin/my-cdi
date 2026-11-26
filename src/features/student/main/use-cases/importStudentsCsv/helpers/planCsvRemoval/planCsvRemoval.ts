import type { StudentEntity } from '@student/entities/student'
import type { CsvRemovalBlockedReason } from '@student-shared'
import { normalizeIne } from '../normalizeIne'
import type { ParseResult } from '../parseStudentCsv/parseStudentCsv.types'

export interface CsvRemovalPlan {
  blockedReason?: CsvRemovalBlockedReason
  toRemove: StudentEntity[]
}

export function planCsvRemoval(existing: StudentEntity[], parsed: ParseResult): CsvRemovalPlan {
  if (parsed.errors.some((error) => error.type === 'MISSING_COLUMNS')) {
    return { blockedReason: 'missingColumns', toRemove: [] }
  }
  if (parsed.errors.length > 0) {
    return { blockedReason: 'rowErrors', toRemove: [] }
  }
  if (parsed.data.length === 0) {
    return { blockedReason: 'emptyFile', toRemove: [] }
  }
  const fileInes = new Set(parsed.data.map((row) => normalizeIne(row.ine)))
  return {
    toRemove: existing.filter((student) => !fileInes.has(normalizeIne(student.ine)))
  }
}
