import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError, PeriodKey } from '@statistics/types'
import { useStatsForPeriod } from '@statistics/api/useStatisticsQueries'
import { buildPeriodRange } from '../../helpers/buildPeriodRange'
import { validateCustomRange } from '../../helpers/validateCustomRange'

interface RetriedFailure {
  range: PeriodRangeDto
  message: string
}

function isSameRange(left: PeriodRangeDto, right: PeriodRangeDto) {
  return left.startDate === right.startDate && left.endDate === right.endDate
}

export function useStatisticsPage() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [customRange, setCustomRange] = useState<PeriodRangeDto>(() => buildPeriodRange('month'))
  const range = period === 'custom' ? customRange : buildPeriodRange(period)
  const customRangeError: CustomRangeError | null =
    period === 'custom' ? validateCustomRange(customRange) : null
  const query = useStatsForPeriod(range, customRangeError === null)

  // A refetch of a failed query without data resets it to "pending" and clears
  // its error, so the failure being retried is kept here (scoped to the range
  // it belongs to) to hold the error state and its disabled button on screen
  // until the retry settles.
  const [retried, setRetried] = useState<RetriedFailure | null>(null)
  const queryErrorMessage = query.isError ? query.error.message || t('app.unknownError') : null
  const isRetryingHere = retried !== null && isSameRange(retried.range, range)
  const isRetrying = isRetryingHere && query.data === undefined
  const errorMessage = queryErrorMessage ?? (isRetrying ? retried.message : null)

  function retry() {
    if (query.data === undefined && errorMessage !== null) {
      setRetried({ range, message: errorMessage })
    }
    const rangeAtRetry = range
    void query
      .refetch()
      .finally(() =>
        setRetried((cur) => (cur && isSameRange(cur.range, rangeAtRetry) ? null : cur))
      )
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
    selectedRange: range,
    dataRange: query.data?.range ?? range,
    stats: query.data?.stats,
    isStale: query.isPlaceholderData || customRangeError !== null,
    isLoading: query.isLoading && !isRetrying,
    errorMessage,
    retry,
    isRetrying
  }
}
