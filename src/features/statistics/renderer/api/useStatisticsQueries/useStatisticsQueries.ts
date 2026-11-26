import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import { statisticsKeys } from '../statisticsKeys'
import type { PeriodRangeDto } from '@statistics-shared'
import type { StatsForRange } from '@statistics/types'

export function useStatsForPeriod(range: PeriodRangeDto, isEnabled: boolean = true) {
  const { t } = useTranslation('common')
  return useQuery({
    queryKey: statisticsKeys.period(range),
    // The range travels with the data so placeholder (previous) data is never
    // drawn against the newly requested range.
    queryFn: async (): Promise<StatsForRange> => {
      const result = await window.electronAPI.statistics.getStats(range)
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return { range, stats: result.data }
    },
    enabled: isEnabled && Boolean(range.startDate && range.endDate),
    placeholderData: keepPreviousData,
    // Route components unmount on navigation; remounting the statistics page
    // must refetch even when cached data is still fresh (staleTime 60s).
    refetchOnMount: 'always'
  })
}
