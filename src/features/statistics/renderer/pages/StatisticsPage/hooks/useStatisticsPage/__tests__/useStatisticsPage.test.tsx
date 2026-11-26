import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ActivityType } from '@types'
import { useStatisticsPage } from '../useStatisticsPage'

const SAMPLE_TOTAL = 12
const TEST_YEAR = 2026
const TEST_DAY = 25

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
    expect(result.current.range).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' })
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
    expect(result.current.range).toEqual({ startDate: '2026-11-20', endDate: '2026-11-10' })
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
    expect(result.current.range).not.toEqual(result.current.dataRange)
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
    expect(result.current.dataRange).toEqual(result.current.range)
  })
})
