import { describe, expect, it } from 'vitest'
import {
  formatLocalDate,
  formatLocalDateTime,
  isFutureLocalDate,
  isFutureLocalDateTime,
  LOCAL_DATE_TIME_LENGTH
} from '@lib/localDateTime'

const YEAR = 2026
const NOV = 10
const DAY = 25
const FULL_LENGTH = 19
const MIN_30 = 30
const HOUR_14 = 14
const HOUR_23 = 23
const MIN_59 = 59
const MIN_45 = 45
const SEC_5 = 5
const MIN_4 = 4
const SEC_7 = 7

describe('localDateTime', () => {
  it('exposes the fixed date-time length', () => expect(LOCAL_DATE_TIME_LENGTH).toBe(FULL_LENGTH))
  it('formats local date', () =>
    expect(formatLocalDate(new Date(YEAR, NOV, DAY, 0, MIN_30))).toBe('2026-11-25'))
  it('formats local date-time with padding', () => {
    expect(formatLocalDateTime(new Date(YEAR, NOV, DAY, 0, MIN_30, SEC_5))).toBe(
      '2026-11-25T00:30:05'
    )
    expect(formatLocalDateTime(new Date(YEAR, 0, 3, 9, MIN_4, SEC_7))).toBe('2026-01-03T09:04:07')
  })
  it('detects a future calendar date', () => {
    const now = new Date(YEAR, NOV, DAY, HOUR_23, MIN_59)
    expect(isFutureLocalDate('2026-11-26', now)).toBe(true)
    expect(isFutureLocalDate('2026-11-25', now)).toBe(false)
    expect(isFutureLocalDate('2026-11-24', now)).toBe(false)
  })
  it('detects a future local start time', () => {
    const now = new Date(YEAR, NOV, DAY, HOUR_14, MIN_30, 0)
    expect(isFutureLocalDateTime('2026-11-25T14:31:00', now)).toBe(true)
    expect(isFutureLocalDateTime('2026-11-25T14:30:00', now)).toBe(false)
    expect(isFutureLocalDateTime('2026-11-25T14:30:00.000Z', now)).toBe(false)
  })
  it('uses local time just after midnight', () => {
    expect(isFutureLocalDateTime('2026-11-25T00:30:00', new Date(YEAR, NOV, DAY, 0, MIN_45))).toBe(
      false
    )
    expect(isFutureLocalDate('2026-11-25', new Date(YEAR, NOV, DAY, 0, MIN_45))).toBe(false)
  })
})
