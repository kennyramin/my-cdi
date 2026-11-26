import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { buildCalendarMonth } from '../../buildCalendarMonth'
import { resolveTabbableDay } from '../resolveTabbableDay'

const VIEW = dayjs('2026-11-01')
const NO_VISITS = new Set<string>()

describe('resolveTabbableDay', () => {
  it('returns the focused iso when it is in the cells', () => {
    const cells = buildCalendarMonth(VIEW, dayjs('2026-11-10'), '2026-11-18', NO_VISITS)
    expect(resolveTabbableDay(cells, '2026-11-20')).toBe('2026-11-20')
  })

  it('ignores a focused iso that is not in the cells', () => {
    const cells = buildCalendarMonth(VIEW, dayjs('2026-11-10'), '2026-11-18', NO_VISITS)
    expect(resolveTabbableDay(cells, '2027-05-05')).toBe('2026-11-18')
  })

  it('returns the selected cell when nothing is focused', () => {
    const cells = buildCalendarMonth(VIEW, dayjs('2026-11-10'), '2026-11-18', NO_VISITS)
    expect(resolveTabbableDay(cells, null)).toBe('2026-11-18')
  })

  it('returns today when nothing is selected', () => {
    const cells = buildCalendarMonth(VIEW, dayjs('2026-11-10'), '2026-01-15', NO_VISITS)
    expect(resolveTabbableDay(cells, null)).toBe('2026-11-10')
  })

  it('falls back to the first day of the viewed month', () => {
    const cells = buildCalendarMonth(VIEW, dayjs('2026-01-15'), '2026-01-15', NO_VISITS)
    expect(cells[0]?.isCurrentMonth).toBe(false)
    expect(resolveTabbableDay(cells, null)).toBe('2026-11-01')
  })
})
