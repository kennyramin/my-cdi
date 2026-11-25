import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMonthlyTrendChart } from '../useMonthlyTrendChart'

const RANGE = { startDate: '2026-11-01', endDate: '2026-11-11' }
const INNER_RIGHT = 690

describe('useMonthlyTrendChart', () => {
  it('uses the default dimensions when no width was measured', () => {
    const { result } = renderHook(() => useMonthlyTrendChart([], RANGE))
    expect(result.current.trend.viewBox).toBe('0 0 700 200')
    expect(result.current.innerRight).toBe(INNER_RIGHT)
  })
})
