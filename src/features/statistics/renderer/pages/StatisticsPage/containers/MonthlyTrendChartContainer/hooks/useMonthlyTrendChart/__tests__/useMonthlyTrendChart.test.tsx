import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMonthlyTrendChart } from '../useMonthlyTrendChart'
import '@shared/i18n/config'

const RANGE = { startDate: '2026-11-01', endDate: '2026-11-11' }
const INNER_RIGHT = 690
const PEAK = 14

describe('useMonthlyTrendChart', () => {
  it('uses the default dimensions when no width was measured', () => {
    const { result } = renderHook(() => useMonthlyTrendChart([], RANGE))
    expect(result.current.trend.viewBox).toBe('0 0 700 200')
    expect(result.current.innerRight).toBe(INNER_RIGHT)
  })

  it('summarises the trend for screen readers with plurals', () => {
    const counts = [
      { date: '2026-11-03', count: 2 },
      { date: '2026-11-05', count: PEAK },
      { date: '2026-11-06', count: PEAK }
    ]
    const { result } = renderHook(() => useMonthlyTrendChart(counts, RANGE))
    expect(result.current.summary).toBe(
      'Du 01/11 au 11/11 : 30 visites sur 3 jours avec visites, maximum 14 le 05/11'
    )
  })

  it('uses singular forms', () => {
    const counts = [{ date: '2026-11-03', count: 1 }]
    const { result } = renderHook(() => useMonthlyTrendChart(counts, RANGE))
    expect(result.current.summary).toBe(
      'Du 01/11 au 11/11 : 1 visite sur 1 jour avec visites, maximum 1 le 03/11'
    )
  })

  it('summarises an empty period', () => {
    const { result } = renderHook(() => useMonthlyTrendChart([], RANGE))
    expect(result.current.summary).toBe('Du 01/11 au 11/11 : aucune visite')
  })
})
