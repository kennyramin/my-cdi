import {
  CUSTOM_END_INPUT_ID,
  CUSTOM_RANGE_MESSAGE_ID,
  CUSTOM_START_INPUT_ID,
  CustomRangeError,
  CustomRangeField,
  CustomRangeInput,
  CustomRangeLabel,
  CustomRangeRow,
  PeriodFilterButton,
  PeriodFilterIcon,
  PeriodFilterRow,
  PeriodFilterWrapper
} from './PeriodFilterContainer.styles'
import { useTranslation } from 'react-i18next'
import { useCustomRangeInputs } from './hooks/useCustomRangeInputs'
import { usePeriodFilter } from './hooks/usePeriodFilter'
import type { PeriodFilterContainerProps } from './types/PeriodFilterContainerProps'

export function PeriodFilterContainer({
  value,
  onChange,
  customRange,
  customRangeError,
  onCustomRangeChange
}: PeriodFilterContainerProps) {
  const { t } = useTranslation('statistics')
  const periodButtons = usePeriodFilter(value, onChange)
  const {
    startDate,
    endDate,
    minDate,
    maxDate,
    onStartDateChange,
    onEndDateChange,
    onEditStart,
    onEditEnd,
    errorMessage,
    errorRole,
    isStartInvalid,
    isEndInvalid
  } = useCustomRangeInputs(customRange, onCustomRangeChange, customRangeError)
  const describedBy = errorMessage === null ? undefined : CUSTOM_RANGE_MESSAGE_ID

  return (
    <PeriodFilterWrapper>
      <PeriodFilterRow>
        {periodButtons.map((button) => (
          <PeriodFilterButton
            key={button.key}
            type="button"
            data-active={button.isActive}
            onClick={button.onSelect}
          >
            {button.iconName ? <PeriodFilterIcon name={button.iconName} /> : null}
            {button.label}
          </PeriodFilterButton>
        ))}
      </PeriodFilterRow>
      {value === 'custom' ? (
        <CustomRangeRow>
          <CustomRangeField>
            <CustomRangeLabel htmlFor={CUSTOM_START_INPUT_ID}>
              {t('customRange.start')}
            </CustomRangeLabel>
            <CustomRangeInput
              id={CUSTOM_START_INPUT_ID}
              type="date"
              aria-invalid={isStartInvalid}
              aria-describedby={isStartInvalid ? describedBy : undefined}
              min={minDate}
              max={maxDate}
              value={startDate}
              onChange={onStartDateChange}
              onFocus={onEditStart}
              onBlur={onEditEnd}
            />
          </CustomRangeField>
          <CustomRangeField>
            <CustomRangeLabel htmlFor={CUSTOM_END_INPUT_ID}>
              {t('customRange.end')}
            </CustomRangeLabel>
            <CustomRangeInput
              id={CUSTOM_END_INPUT_ID}
              type="date"
              aria-invalid={isEndInvalid}
              aria-describedby={describedBy}
              min={minDate}
              max={maxDate}
              value={endDate}
              onChange={onEndDateChange}
              onFocus={onEditStart}
              onBlur={onEditEnd}
            />
          </CustomRangeField>
          {errorMessage !== null ? (
            <CustomRangeError key={errorRole} id={CUSTOM_RANGE_MESSAGE_ID} role={errorRole}>
              {errorMessage}
            </CustomRangeError>
          ) : null}
        </CustomRangeRow>
      ) : null}
    </PeriodFilterWrapper>
  )
}
