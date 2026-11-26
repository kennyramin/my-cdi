import { describe, it, expect } from 'vitest'
import { shiftDayByKey } from '../shiftDayByKey'

describe('shiftDayByKey', () => {
  it('moves one day forward with ArrowRight across a month boundary', () => {
    expect(shiftDayByKey('2026-11-30', 'ArrowRight')).toBe('2026-12-01')
  })

  it('moves one week back with ArrowUp', () => {
    expect(shiftDayByKey('2026-11-02', 'ArrowUp')).toBe('2026-10-26')
  })

  it('moves one day back with ArrowLeft', () => {
    expect(shiftDayByKey('2026-03-01', 'ArrowLeft')).toBe('2026-02-28')
  })

  it('moves one week forward with ArrowDown across the DST change', () => {
    expect(shiftDayByKey('2026-03-25', 'ArrowDown')).toBe('2026-04-01')
  })

  it('returns null for other keys', () => {
    expect(shiftDayByKey('2026-11-10', 'Tab')).toBeNull()
  })
})
