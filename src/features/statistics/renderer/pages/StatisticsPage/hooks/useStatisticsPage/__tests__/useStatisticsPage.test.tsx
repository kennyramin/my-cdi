import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ActivityType } from '@types'
import { useStatisticsPage } from '../useStatisticsPage'
import '@shared/i18n/config'

const SAMPLE_TOTAL = 12
const TEST_YEAR = 2026
const TEST_DAY = 25
const WEEK_RANGE = { startDate: '2026-11-23', endDate: '2026-11-29' }

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useStatisticsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(TEST_YEAR, 10, TEST_DAY, 10, 0))
    vi.stubGlobal('electronAPI', {
      statistics: {
        getStats: vi.fn().mockResolvedValue({
          success: true,
          data: {
            totalVisits: SAMPLE_TOTAL,
            averagePerDay: 1,
            morningRate: 0,
            afternoonRate: 0,
            dailyCounts: [],
            activityCounts: [{ activity: ActivityType.WORK, count: 1 }],
            classCounts: []
          }
        })
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to "month" period and exposes stats once loaded', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    expect(result.current.period).toBe('month')
    await waitFor(() => expect(result.current.stats).toBeDefined())
    expect(result.current.stats?.totalVisits).toBe(SAMPLE_TOTAL)
  })

  it('does not expose a range field', () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    expect(result.current).not.toHaveProperty('range')
  })

  it('updates the period when selectPeriod is called', () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    act(() => {
      result.current.selectPeriod('week')
    })
    expect(result.current.period).toBe('week')
  })

  it('seeds the custom range with the previously selected preset range', () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    act(() => {
      result.current.selectPeriod('custom')
    })
    expect(result.current.customRange).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' })
  })

  it('queries the inclusive custom range', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    act(() => {
      result.current.selectPeriod('custom')
    })
    act(() => {
      result.current.setCustomRange({ startDate: '2026-11-03', endDate: '2026-11-14' })
    })
    await waitFor(() =>
      expect(window.electronAPI.statistics.getStats).toHaveBeenCalledWith({
        startDate: '2026-11-03',
        endDate: '2026-11-14'
      })
    )
  })

  it('reports endBeforeStart and never queries an inverted range', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    act(() => {
      result.current.selectPeriod('custom')
    })
    act(() => {
      result.current.setCustomRange({ startDate: '2026-11-20', endDate: '2026-11-10' })
    })
    expect(result.current.customRangeError).toBe('endBeforeStart')
    await act(async () => {
      await Promise.resolve()
    })
    expect(window.electronAPI.statistics.getStats).not.toHaveBeenCalledWith({
      startDate: '2026-11-20',
      endDate: '2026-11-10'
    })
  })

  it('keeps the previous stats while an invalid custom range is shown', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.stats).toBeDefined())
    act(() => {
      result.current.selectPeriod('custom')
    })
    act(() => {
      result.current.setCustomRange({ startDate: '2026-11-20', endDate: '2026-11-10' })
    })
    expect(result.current.customRangeError).toBe('endBeforeStart')
    expect(result.current.stats?.totalVisits).toBe(SAMPLE_TOTAL)
  })

  it('keeps the range of the displayed data while an invalid range is typed', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.stats).toBeDefined())
    act(() => {
      result.current.selectPeriod('custom')
    })
    act(() => {
      result.current.setCustomRange({ startDate: '2026-11-20', endDate: '2026-11-10' })
    })
    expect(result.current.customRange).toEqual({ startDate: '2026-11-20', endDate: '2026-11-10' })
    expect(result.current.dataRange).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(result.current.isStale).toBe(true)
  })

  it('keeps the old data range while a new preset is pending, then switches', async () => {
    const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.stats).toBeDefined())
    expect(result.current.isStale).toBe(false)
    let resolveWeek: (value: unknown) => void = () => undefined
    vi.mocked(window.electronAPI.statistics.getStats).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWeek = resolve
      })
    )
    act(() => {
      result.current.selectPeriod('week')
    })
    expect(result.current.dataRange).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(window.electronAPI.statistics.getStats).toHaveBeenLastCalledWith(WEEK_RANGE)
    expect(result.current.isStale).toBe(true)
    await act(async () => {
      resolveWeek({
        success: true,
        data: {
          totalVisits: 1,
          averagePerDay: 1,
          morningRate: 0,
          afternoonRate: 0,
          dailyCounts: [],
          activityCounts: [],
          classCounts: []
        }
      })
    })
    await waitFor(() => expect(result.current.isStale).toBe(false))
    expect(result.current.dataRange).toEqual(WEEK_RANGE)
  })

  describe('error handling', () => {
    const failure = { success: false, error: 'boom' }
    const sampleStats = {
      totalVisits: SAMPLE_TOTAL,
      averagePerDay: 1,
      morningRate: 0,
      afternoonRate: 0,
      dailyCounts: [],
      activityCounts: [],
      classCounts: []
    }

    it('exposes errorMessage and no stats when the first query fails', async () => {
      vi.mocked(window.electronAPI.statistics.getStats).mockResolvedValue(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      expect(result.current.stats).toBeUndefined()
      expect(result.current.isLoading).toBe(false)
    })

    it('keeps stats and exposes errorMessage when a refetch fails', async () => {
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.stats).toBeDefined())
      expect(result.current.errorMessage).toBeNull()
      vi.mocked(window.electronAPI.statistics.getStats).mockResolvedValueOnce(failure)
      await act(async () => {
        result.current.retry()
      })
      await waitFor(() => expect(result.current.errorMessage).not.toBeNull())
      expect(result.current.stats?.totalVisits).toBe(SAMPLE_TOTAL)
    })

    it('falls back to the unknown-error text when the error message is empty', async () => {
      vi.mocked(window.electronAPI.statistics.getStats).mockResolvedValue({
        success: false,
        error: ''
      })
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() =>
        expect(result.current.errorMessage).toBe('Une erreur inconnue est survenue')
      )
    })

    it('retry refetches and clears the error on success', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      getStats.mockResolvedValueOnce({ success: true, data: sampleStats })
      await act(async () => {
        result.current.retry()
      })
      await waitFor(() => expect(result.current.stats).toBeDefined())
      expect(result.current.errorMessage).toBeNull()
      expect(getStats).toHaveBeenCalledTimes(2)
    })

    it('isRetrying is true while the retry is in flight', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      expect(result.current.isRetrying).toBe(false)
      let resolveRetry: (value: unknown) => void = () => undefined
      getStats.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve
        })
      )
      act(() => {
        result.current.retry()
      })
      await waitFor(() => expect(result.current.isRetrying).toBe(true))
      await act(async () => {
        resolveRetry({ success: true, data: sampleStats })
      })
      await waitFor(() => expect(result.current.isRetrying).toBe(false))
    })

    it('does not leak a pending retry onto another period', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      let resolveRetry: (value: unknown) => void = () => undefined
      getStats.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve
        })
      )
      act(() => {
        result.current.retry()
      })
      await waitFor(() => expect(result.current.isRetrying).toBe(true))
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      act(() => {
        result.current.selectPeriod('week')
      })
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.errorMessage).toBeNull()
      expect(result.current.isLoading).toBe(true)
      await act(async () => {
        resolveRetry(failure)
      })
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.isLoading).toBe(true)
    })

    it('keeps a pending retry when switching A to B to A before it settles', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      act(() => {
        result.current.retry()
      })
      expect(result.current.isRetrying).toBe(true)
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      act(() => {
        result.current.selectPeriod('week')
      })
      expect(result.current.isRetrying).toBe(false)
      act(() => {
        result.current.selectPeriod('month')
      })
      expect(result.current.isRetrying).toBe(true)
      expect(result.current.errorMessage).toBe('boom')
    })

    it('does not clear a newer retry when an older retry on another period settles', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      let resolveMonthRetry: (value: unknown) => void = () => undefined
      getStats.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMonthRetry = resolve
        })
      )
      act(() => {
        result.current.retry()
      })
      getStats.mockResolvedValueOnce(failure)
      act(() => {
        result.current.selectPeriod('week')
      })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      act(() => {
        result.current.retry()
      })
      expect(result.current.isRetrying).toBe(true)
      await act(async () => {
        resolveMonthRetry(failure)
      })
      expect(result.current.isRetrying).toBe(true)
    })

    it('shows the normal state when switching back after a retry settled elsewhere', async () => {
      const getStats = vi.mocked(window.electronAPI.statistics.getStats)
      getStats.mockResolvedValueOnce(failure)
      const { result } = renderHook(() => useStatisticsPage(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
      let resolveRetry: (value: unknown) => void = () => undefined
      getStats.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve
        })
      )
      act(() => {
        result.current.retry()
      })
      await waitFor(() => expect(result.current.isRetrying).toBe(true))
      getStats.mockResolvedValueOnce({ success: true, data: sampleStats })
      act(() => {
        result.current.selectPeriod('week')
      })
      await waitFor(() => expect(result.current.stats).toBeDefined())
      await act(async () => {
        resolveRetry({ success: true, data: sampleStats })
      })
      act(() => {
        result.current.selectPeriod('month')
      })
      await waitFor(() => expect(result.current.stats).toBeDefined())
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.errorMessage).toBeNull()
    })
  })
})
