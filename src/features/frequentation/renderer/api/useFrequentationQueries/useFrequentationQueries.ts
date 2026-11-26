import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import { frequentationKeys } from '../frequentationKeys'
import type { JournalEntryDto, FrequentationResponseDto } from '@frequentation-shared'
import type { DateRangeFilter } from '@frequentation/types'

// Route components unmount on navigation; deleting a student cascades to their
// visits, so the journal must refetch on remount even when cached data is fresh.
const JOURNAL_REFETCH_ON_MOUNT = 'always'

export function useJournalEntries(dateRange: DateRangeFilter) {
  const { t } = useTranslation('common')
  return useQuery({
    queryKey: frequentationKeys.journalEntries(dateRange),
    queryFn: async (): Promise<JournalEntryDto[]> => {
      const result = await window.electronAPI.frequentation.getJournalEntries(dateRange)
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    },
    enabled: Boolean(dateRange.startDate && dateRange.endDate),
    refetchOnMount: JOURNAL_REFETCH_ON_MOUNT
  })
}

export function useFrequentationDetail(id: number | null) {
  const { t } = useTranslation('common')
  return useQuery({
    queryKey: id !== null ? frequentationKeys.detail(id) : frequentationKeys.details(),
    queryFn: async (): Promise<FrequentationResponseDto> => {
      if (id === null) {
        throw new Error('Missing id')
      }
      const result = await window.electronAPI.frequentation.get({ id })
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    },
    enabled: id !== null
  })
}
