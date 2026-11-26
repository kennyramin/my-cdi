export const BACKUP_WARNING_THRESHOLD_DAYS = 30

const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND

export type BackupStatusView =
  { kind: 'never' } | { kind: 'days'; days: number; isWarning: boolean }

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function getBackupStatusView(lastBackupAt: string | null, now: Date): BackupStatusView {
  if (lastBackupAt === null) {
    return { kind: 'never' }
  }
  const elapsed = startOfLocalDay(now) - startOfLocalDay(new Date(lastBackupAt))
  const days = Math.max(0, Math.round(elapsed / MS_PER_DAY))
  return { kind: 'days', days, isWarning: days > BACKUP_WARNING_THRESHOLD_DAYS }
}
