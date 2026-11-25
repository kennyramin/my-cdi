import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError } from '@statistics/types'

export function validateCustomRange(range: PeriodRangeDto): CustomRangeError | null {
  if (!range.startDate || !range.endDate) {
    return 'incomplete'
  }
  if (range.endDate < range.startDate) {
    return 'endBeforeStart'
  }
  return null
}
