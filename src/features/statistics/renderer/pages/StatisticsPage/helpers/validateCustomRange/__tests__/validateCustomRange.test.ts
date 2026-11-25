import { describe, it, expect } from 'vitest'
import { validateCustomRange } from '../validateCustomRange'

describe('validateCustomRange', () => {
  it('accepts an ordered range', () => {
    expect(validateCustomRange({ startDate: '2026-11-01', endDate: '2026-11-30' })).toBeNull()
  })

  it('accepts a single-day range', () => {
    expect(validateCustomRange({ startDate: '2026-11-05', endDate: '2026-11-05' })).toBeNull()
  })

  it('rejects end before start', () => {
    expect(validateCustomRange({ startDate: '2026-11-30', endDate: '2026-11-01' })).toBe(
      'endBeforeStart'
    )
  })

  it('flags a missing start date', () => {
    expect(validateCustomRange({ startDate: '', endDate: '2026-11-01' })).toBe('incomplete')
  })

  it('flags a missing end date', () => {
    expect(validateCustomRange({ startDate: '2026-11-01', endDate: '' })).toBe('incomplete')
  })
})
