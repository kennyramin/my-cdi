import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError, PeriodKey } from '@statistics/types'
import { useStatsForPeriod } from '@statistics/api/useStatisticsQueries'
import { buildPeriodRange } from '../../helpers/buildPeriodRange'
import { validateCustomRange } from '../../helpers/validateCustomRange'

export function useStatisticsPage() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [customRange, setCustomRange] = useState<PeriodRangeDto>(() => buildPeriodRange('month'))
  const range = period === 'custom' ? customRange : buildPeriodRange(period)
  const customRangeError: CustomRangeError | null =
    period === 'custom' ? validateCustomRange(customRange) : null
  const query = useStatsForPeriod(range, customRangeError === null)

  // A refetch of a failed query without data resets it to "pending" and clears
  // its error, so the failure being retried is kept here to hold the error
  // state (and its disabled button) on screen until the retry settles.
  const [failureBeingRetried, setFailureBeingRetried] = useState<string | null>(null)
  const queryErrorMessage = query.isError ? query.error.message || t('app.unknownError') : null
  const isRetrying = failureBeingRetried !== null
  const errorMessage = queryErrorMessage ?? (query.data === undefined ? failureBeingRetried : null)

  function retry() {
    setFailureBeingRetried(errorMessage)
    void query.refetch().finally(() => setFailureBeingRetried(null))
  }

  function selectPeriod(next: PeriodKey) {
    if (next === 'custom' && period !== 'custom') {
      setCustomRange(buildPeriodRange(period))
    }
    setPeriod(next)
  }

  return {
    period,
    selectPeriod,
    customRange,
    setCustomRange,
    customRangeError,
    dataRange: query.data?.range ?? range,
    stats: query.data?.stats,
    isStale: query.isPlaceholderData || customRangeError !== null,
    isLoading: query.isLoading && !isRetrying,
    errorMessage,
    retry,
    isRetrying
  }
}
