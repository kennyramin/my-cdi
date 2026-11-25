import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError } from '@statistics/types'

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

  return {
    startDate: customRange.startDate,
    endDate: customRange.endDate,
    onStartDateChange,
    onEndDateChange,
    errorMessage: customRangeError === null ? null : errorMessages[customRangeError]
  }
}
