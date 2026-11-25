import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError } from '@statistics/types'
import {
  MAX_CUSTOM_YEAR,
  MIN_CUSTOM_YEAR,
  isPlausibleCustomDate
} from '../../../../helpers/validateCustomRange'

const MIN_CUSTOM_DATE = `${MIN_CUSTOM_YEAR}-01-01`
const MAX_CUSTOM_DATE = `${MAX_CUSTOM_YEAR}-12-31`

export function useCustomRangeInputs(
  customRange: PeriodRangeDto,
  onCustomRangeChange: (next: PeriodRangeDto) => void,
  customRangeError: CustomRangeError | null
) {
  const { t } = useTranslation('statistics')
  const errorMessages: Record<CustomRangeError, string> = {
    incomplete: t('customRange.errors.incomplete'),
    endBeforeStart: t('customRange.errors.endBeforeStart')
  }

  function onStartDateChange(event: ChangeEvent<HTMLInputElement>) {
    onCustomRangeChange({ ...customRange, startDate: event.target.value })
  }

  function onEndDateChange(event: ChangeEvent<HTMLInputElement>) {
    onCustomRangeChange({ ...customRange, endDate: event.target.value })
  }

  const isIncomplete = customRangeError === 'incomplete'

  return {
    startDate: customRange.startDate,
    endDate: customRange.endDate,
    minDate: MIN_CUSTOM_DATE,
    maxDate: MAX_CUSTOM_DATE,
    onStartDateChange,
    onEndDateChange,
    errorMessage: customRangeError === null ? null : errorMessages[customRangeError],
    // Typing into a native date input emits partial values: only a genuinely
    // inverted range is an alert; an incomplete one is a polite status.
    errorRole: isIncomplete ? ('status' as const) : ('alert' as const),
    isStartInvalid: isIncomplete && !isPlausibleCustomDate(customRange.startDate),
    isEndInvalid:
      customRangeError === 'endBeforeStart' ||
      (isIncomplete && !isPlausibleCustomDate(customRange.endDate))
  }
}
