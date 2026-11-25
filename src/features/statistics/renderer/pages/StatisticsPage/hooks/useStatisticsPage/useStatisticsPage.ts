import { useState } from 'react'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError, PeriodKey } from '@statistics/types'
import { useStatsForPeriod } from '@statistics/api/useStatisticsQueries'
import { buildPeriodRange } from '../../helpers/buildPeriodRange'
import { validateCustomRange } from '../../helpers/validateCustomRange'

export function useStatisticsPage() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [customRange, setCustomRange] = useState<PeriodRangeDto>(() => buildPeriodRange('month'))
  const range = period === 'custom' ? customRange : buildPeriodRange(period)
  const customRangeError: CustomRangeError | null =
    period === 'custom' ? validateCustomRange(customRange) : null
  const query = useStatsForPeriod(range, customRangeError === null)

  function selectPeriod(next: PeriodKey) {
    if (next === 'custom' && period !== 'custom') {
      setCustomRange(buildPeriodRange(period))
    }
    setPeriod(next)
  }

  return {
    period,
    selectPeriod,
    range,
    customRange,
    setCustomRange,
    customRangeError,
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error
  }
}
