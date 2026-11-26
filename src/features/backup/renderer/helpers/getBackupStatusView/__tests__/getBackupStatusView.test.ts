import { describe, it, expect } from 'vitest'
import { getBackupStatusView, BACKUP_WARNING_THRESHOLD_DAYS } from '../getBackupStatusView'

const YEAR = 2026
const NOVEMBER = 10
const TODAY = 25
const FUTURE_OFFSET_DAYS = -3
const NOON = 12
const MORNING = 9
const LATE_HOUR = 23
const LATE_MINUTE = 59
const NOW = new Date(YEAR, NOVEMBER, TODAY, NOON)

function daysAgo(days: number): string {
  return new Date(YEAR, NOVEMBER, TODAY - days, MORNING).toISOString()
}

describe('getBackupStatusView', () => {
  it('returns never when there is no backup', () => {
    expect(getBackupStatusView(null, NOW)).toEqual({ kind: 'never' })
  })

  it('returns 0 days for a backup made today', () => {
    expect(getBackupStatusView(daysAgo(0), NOW)).toEqual({
      kind: 'days',
      days: 0,
      isWarning: false
    })
  })

  it('returns 1 day for yesterday', () => {
    expect(getBackupStatusView(daysAgo(1), NOW)).toEqual({
      kind: 'days',
      days: 1,
      isWarning: false
    })
  })

  it('does not warn at exactly the threshold', () => {
    expect(getBackupStatusView(daysAgo(BACKUP_WARNING_THRESHOLD_DAYS), NOW)).toEqual({
      kind: 'days',
      days: BACKUP_WARNING_THRESHOLD_DAYS,
      isWarning: false
    })
  })

  it('warns one day past the threshold', () => {
    expect(getBackupStatusView(daysAgo(BACKUP_WARNING_THRESHOLD_DAYS + 1), NOW)).toEqual({
      kind: 'days',
      days: BACKUP_WARNING_THRESHOLD_DAYS + 1,
      isWarning: true
    })
  })

  it('clamps a future timestamp to 0 days', () => {
    expect(getBackupStatusView(daysAgo(FUTURE_OFFSET_DAYS), NOW)).toEqual({
      kind: 'days',
      days: 0,
      isWarning: false
    })
  })

  it('counts local calendar days across midnight', () => {
    const lateEvening = new Date(YEAR, NOVEMBER, TODAY - 1, LATE_HOUR, LATE_MINUTE).toISOString()
    const justAfterMidnight = new Date(YEAR, NOVEMBER, TODAY, 0, 1)
    expect(getBackupStatusView(lateEvening, justAfterMidnight)).toEqual({
      kind: 'days',
      days: 1,
      isWarning: false
    })
  })
})
