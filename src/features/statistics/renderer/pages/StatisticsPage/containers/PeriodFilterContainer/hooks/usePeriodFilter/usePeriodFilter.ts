import { useTranslation } from 'react-i18next'
import type { PeriodKey } from '@statistics/types'

interface PeriodButtonConfig {
  key: PeriodKey
  labelKey: string
  iconName?: string
}

const BUTTONS: PeriodButtonConfig[] = [
  { key: 'week', labelKey: 'period.week' },
  { key: 'month', labelKey: 'period.month' },
  { key: 'quarter', labelKey: 'period.quarter' },
  { key: 'semester', labelKey: 'period.semester' },
  { key: 'schoolYear', labelKey: 'period.schoolYear' },
  { key: 'custom', labelKey: 'period.custom', iconName: 'date_range' }
]

export interface PeriodButtonViewModel {
  key: PeriodKey
  label: string
  iconName?: string
  isActive: boolean
  onSelect: () => void
}

export function usePeriodFilter(
  value: PeriodKey,
  onChange: (key: PeriodKey) => void
): PeriodButtonViewModel[] {
  const { t } = useTranslation('statistics')
  return BUTTONS.map((button) => ({
    key: button.key,
    label: t(button.labelKey),
    iconName: button.iconName,
    isActive: button.key === value,
    onSelect: () => onChange(button.key)
  }))
}
