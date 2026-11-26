import { describe, it, expect } from 'vitest'
import { countDaysBetween } from '../countDaysBetween'

const TEN = 10
const TWO = 2

describe('countDaysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(countDaysBetween('2026-11-01', '2026-11-11')).toBe(TEN)
  })

  it('stays whole across the autumn DST change', () => {
    expect(countDaysBetween('2026-10-20', '2026-10-30')).toBe(TEN)
  })

  it('stays whole across the spring DST change', () => {
    expect(countDaysBetween('2026-03-28', '2026-03-30')).toBe(TWO)
  })
})
