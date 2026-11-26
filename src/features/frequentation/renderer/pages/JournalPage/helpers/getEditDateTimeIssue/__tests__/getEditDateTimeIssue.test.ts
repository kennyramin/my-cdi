import { describe, it, expect } from 'vitest'
import { getEditDateTimeIssue } from '../getEditDateTimeIssue'

const NOW = new Date('2026-04-01T12:00:00')

describe('getEditDateTimeIssue', () => {
  it('returns null for a past date and time', () => {
    expect(getEditDateTimeIssue('2026-03-31', '23:59', NOW)).toBeNull()
  })

  it('accepts midnight on the current day', () => {
    expect(getEditDateTimeIssue('2026-04-01', '00:00', NOW)).toBeNull()
  })

  it('flags a later time today as future', () => {
    expect(getEditDateTimeIssue('2026-04-01', '12:01', NOW)).toBe('future')
  })

  it('flags a later date as future', () => {
    expect(getEditDateTimeIssue('2026-04-02', '00:00', NOW)).toBe('future')
  })

  it('flags an empty date or time as required', () => {
    expect(getEditDateTimeIssue('', '10:00', NOW)).toBe('required')
    expect(getEditDateTimeIssue('2026-04-01', '', NOW)).toBe('required')
  })
})
