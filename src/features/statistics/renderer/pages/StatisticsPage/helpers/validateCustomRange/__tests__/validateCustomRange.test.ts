import { describe, it, expect } from 'vitest'
import { MAX_CUSTOM_YEAR, MIN_CUSTOM_YEAR, validateCustomRange } from '../validateCustomRange'

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

  it('treats keyboard-typing intermediate years as incomplete', () => {
    expect(validateCustomRange({ startDate: '2026-11-01', endDate: '0002-11-30' })).toBe(
      'incomplete'
    )
    expect(validateCustomRange({ startDate: '2026-11-01', endDate: '0202-11-30' })).toBe(
      'incomplete'
    )
    expect(validateCustomRange({ startDate: '0020-11-01', endDate: '2026-11-30' })).toBe(
      'incomplete'
    )
  })

  it('accepts the year boundaries and rejects just outside them', () => {
    const below = String(MIN_CUSTOM_YEAR - 1)
    const above = String(MAX_CUSTOM_YEAR + 1)
    expect(
      validateCustomRange({
        startDate: `${MIN_CUSTOM_YEAR}-01-01`,
        endDate: `${MAX_CUSTOM_YEAR}-12-31`
      })
    ).toBeNull()
    expect(validateCustomRange({ startDate: `${below}-12-31`, endDate: '2026-01-01' })).toBe(
      'incomplete'
    )
    expect(validateCustomRange({ startDate: '2026-01-01', endDate: `${above}-01-01` })).toBe(
      'incomplete'
    )
  })

  it('reports incomplete before endBeforeStart when a year is implausible', () => {
    expect(validateCustomRange({ startDate: '2026-11-30', endDate: '0002-11-01' })).toBe(
      'incomplete'
    )
  })
})
