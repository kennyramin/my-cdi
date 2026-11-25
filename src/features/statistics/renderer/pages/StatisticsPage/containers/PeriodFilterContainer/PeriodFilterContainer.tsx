import {
  CUSTOM_END_INPUT_ID,
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
  const { startDate, endDate, onStartDateChange, onEndDateChange, errorMessage } =
    useCustomRangeInputs(customRange, onCustomRangeChange, customRangeError)

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
              aria-label={t('customRange.start')}
              value={startDate}
              onChange={onStartDateChange}
            />
          </CustomRangeField>
          <CustomRangeField>
            <CustomRangeLabel htmlFor={CUSTOM_END_INPUT_ID}>
              {t('customRange.end')}
            </CustomRangeLabel>
            <CustomRangeInput
              id={CUSTOM_END_INPUT_ID}
              type="date"
              aria-label={t('customRange.end')}
              aria-invalid={errorMessage !== null}
              value={endDate}
              onChange={onEndDateChange}
            />
          </CustomRangeField>
          {errorMessage !== null ? (
            <CustomRangeError role="alert">{errorMessage}</CustomRangeError>
          ) : null}
        </CustomRangeRow>
      ) : null}
    </PeriodFilterWrapper>
  )
}
