import type { PeriodRangeDto } from '@statistics-shared'

export const EXPORT_KINDS = [
  'journal',
  'visitsByDay',
  'visitsByActivity',
  'visitsByClass',
  'students'
] as const

export type ExportKind = (typeof EXPORT_KINDS)[number]

const KIND_USES_PERIOD = {
  journal: true,
  visitsByDay: true,
  visitsByActivity: true,
  visitsByClass: true,
  students: false
} satisfies Record<ExportKind, boolean>

export const isPeriodExportKind = (kind: ExportKind): boolean => KIND_USES_PERIOD[kind]

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
