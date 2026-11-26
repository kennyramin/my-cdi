import type { PeriodRangeDto } from '@statistics-shared'

export const EXPORT_KINDS = [
  'journal',
  'visitsByDay',
  'visitsByActivity',
  'visitsByClass',
  'students'
] as const

export type ExportKind = (typeof EXPORT_KINDS)[number]

export interface ExportRequestDto {
  kind: ExportKind
  period?: PeriodRangeDto
  includeNames: boolean
  acknowledgedPersonalData?: boolean
}

export type ExportResultDto = { path: string; rows: number } | { cancelled: true }

export function isCancelledExport(result: ExportResultDto): result is { cancelled: true } {
  return 'cancelled' in result
}
