import { describe, it, expect } from 'vitest'
import { formatDayMonth } from '../formatDayMonth'

describe('formatDayMonth', () => {
  it('formats an ISO date as DD/MM', () => {
    expect(formatDayMonth('2026-11-02')).toBe('02/11')
  })
})
