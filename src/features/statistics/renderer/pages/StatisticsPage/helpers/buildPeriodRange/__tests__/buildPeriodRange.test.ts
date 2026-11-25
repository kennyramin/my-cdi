import { describe, it, expect } from 'vitest'
import { buildPeriodRange } from '../buildPeriodRange'

const YEAR = 2026
const NEXT_YEAR = 2027
const HALF_HOUR = 30
const DAY_25 = 25
const DAY_31 = 31
const HOUR_23 = 23

describe('buildPeriodRange', () => {
  it('runs under Europe/Paris (precondition)', () => {
    expect(new Date(YEAR, 10, 1, 0, HALF_HOUR).getUTCDate()).toBe(DAY_31)
  })

  it('uses the local month at 00:30 on the 1st', () => {
    expect(buildPeriodRange('month', new Date(YEAR, 10, 1, 0, HALF_HOUR))).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-30'
    })
  })

  it('uses the local Monday at 00:30', () => {
    expect(buildPeriodRange('week', new Date(YEAR, 10, 2, 0, HALF_HOUR))).toEqual({
      startDate: '2026-11-02',
      endDate: '2026-11-08'
    })
  })

  it('keeps whole days for a week ending on the DST change', () => {
    expect(buildPeriodRange('week', new Date(YEAR, 9, DAY_25, 12, 0))).toEqual({
      startDate: '2026-10-19',
      endDate: '2026-10-25'
    })
  })

  it('uses the local quarter at 00:30 on its first day', () => {
    expect(buildPeriodRange('quarter', new Date(YEAR, 9, 1, 0, HALF_HOUR))).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-12-31'
    })
  })

  it('uses the local semester at 00:30 on its first day', () => {
    expect(buildPeriodRange('semester', new Date(YEAR, 6, 1, 0, HALF_HOUR))).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-12-31'
    })
  })

  it('returns Sep 1 → Aug 31 next year when today is in Sep–Dec', () => {
    expect(buildPeriodRange('schoolYear', new Date(YEAR, 10, DAY_25))).toEqual({
      startDate: '2026-09-01',
      endDate: '2027-08-31'
    })
  })

  it('returns Sep 1 last year → Aug 31 when today is in Jan–Aug', () => {
    expect(buildPeriodRange('schoolYear', new Date(NEXT_YEAR, 2, 10))).toEqual({
      startDate: '2026-09-01',
      endDate: '2027-08-31'
    })
  })

  it('starts the new school year at 00:30 local on Sep 1', () => {
    expect(buildPeriodRange('schoolYear', new Date(YEAR, 8, 1, 0, HALF_HOUR))).toEqual({
      startDate: '2026-09-01',
      endDate: '2027-08-31'
    })
  })

  it('keeps Aug 31 23:30 local in the previous school year', () => {
    expect(buildPeriodRange('schoolYear', new Date(YEAR, 7, DAY_31, HOUR_23, HALF_HOUR))).toEqual({
      startDate: '2025-09-01',
      endDate: '2026-08-31'
    })
  })

  it('returns the Monday-Sunday week containing today', () => {
    // Wednesday 2026-04-29
    const today = new Date('2026-04-29T12:00:00.000Z')
    const range = buildPeriodRange('week', today)
    expect(range).toEqual({ startDate: '2026-04-27', endDate: '2026-05-03' })
  })

  it('handles Sunday by treating it as the last day of the week', () => {
    const today = new Date('2026-05-03T12:00:00.000Z')
    const range = buildPeriodRange('week', today)
    expect(range).toEqual({ startDate: '2026-04-27', endDate: '2026-05-03' })
  })

  it('returns the full current month for "month"', () => {
    const today = new Date('2026-04-15T12:00:00.000Z')
    const range = buildPeriodRange('month', today)
    expect(range).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' })
  })

  it('returns the current calendar quarter', () => {
    const today = new Date('2026-05-15T12:00:00.000Z')
    const range = buildPeriodRange('quarter', today)
    expect(range).toEqual({ startDate: '2026-04-01', endDate: '2026-06-30' })
  })

  it('returns first semester when month is January-June', () => {
    const today = new Date('2026-03-15T12:00:00.000Z')
    const range = buildPeriodRange('semester', today)
    expect(range).toEqual({ startDate: '2026-01-01', endDate: '2026-06-30' })
  })

  it('returns second semester when month is July-December', () => {
    const today = new Date('2026-09-15T12:00:00.000Z')
    const range = buildPeriodRange('semester', today)
    expect(range).toEqual({ startDate: '2026-07-01', endDate: '2026-12-31' })
  })

  it('falls back to the current month for "custom"', () => {
    const today = new Date('2026-04-15T12:00:00.000Z')
    const range = buildPeriodRange('custom', today)
    expect(range).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' })
  })
})
