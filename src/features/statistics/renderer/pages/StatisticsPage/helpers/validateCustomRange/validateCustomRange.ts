import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError } from '@statistics/types'

export const MIN_CUSTOM_YEAR = 2000
export const MAX_CUSTOM_YEAR = 2100
const YEAR_LENGTH = 4

export function isPlausibleCustomDate(isoDate: string): boolean {
  if (!isoDate) {
    return false
  }
  const year = Number(isoDate.slice(0, YEAR_LENGTH))
  return year >= MIN_CUSTOM_YEAR && year <= MAX_CUSTOM_YEAR
}

export function validateCustomRange(range: PeriodRangeDto): CustomRangeError | null {
  if (!isPlausibleCustomDate(range.startDate) || !isPlausibleCustomDate(range.endDate)) {
    return 'incomplete'
  }
  if (range.endDate < range.startDate) {
    return 'endBeforeStart'
  }
  return null
}
