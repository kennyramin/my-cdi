import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError, PeriodKey } from '@statistics/types'

export interface PeriodFilterContainerProps {
  value: PeriodKey
  onChange: (next: PeriodKey) => void
  customRange: PeriodRangeDto
  customRangeError: CustomRangeError | null
  onCustomRangeChange: (next: PeriodRangeDto) => void
}
