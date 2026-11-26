import type { PeriodRangeDto } from '@statistics-shared'

export type ExportButtonContainerProps =
  | {
      scope: 'statistics'
      period: PeriodRangeDto
      disabled: boolean
      disabledDescriptionId?: string
    }
  | { scope: 'students' }
