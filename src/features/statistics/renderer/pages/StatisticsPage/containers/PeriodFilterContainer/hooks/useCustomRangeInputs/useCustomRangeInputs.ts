import { useState } from 'react'
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
  const [isEditing, setIsEditing] = useState(false)
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

  function onEditStart() {
    setIsEditing(true)
  }

  function onEditEnd() {
    setIsEditing(false)
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
    onEditStart,
    onEditEnd,
    // Typing into a native date input emits partial values (month "1" before
    // "11"): while editing, every message is a polite status. Only a settled,
    // genuinely inverted range is an alert.
    errorRole: isIncomplete || isEditing ? ('status' as const) : ('alert' as const),
    isStartInvalid: isIncomplete && !isPlausibleCustomDate(customRange.startDate),
    isEndInvalid:
      customRangeError === 'endBeforeStart' ||
      (isIncomplete && !isPlausibleCustomDate(customRange.endDate))
  }
}
