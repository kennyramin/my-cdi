import type { PeriodRangeDto } from '@statistics-shared'

export type ExportScopeProps =
  { scope: 'statistics'; period: PeriodRangeDto } | { scope: 'students' }
