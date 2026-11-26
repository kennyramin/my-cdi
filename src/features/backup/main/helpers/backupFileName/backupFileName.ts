import { formatLocalDateTime } from '@lib/localDateTime'
import { AUTOMATIC_BACKUP_REASONS, type AutomaticBackupReason } from '@backup-shared'

export const RESTORE_REASON: AutomaticBackupReason = 'restore'

const NAME_PREFIX = 'auto-'
const NAME_EXTENSION = '.db'
const NAME_PATTERN = new RegExp(
  `^${NAME_PREFIX}(?<year>\\d{4})(?<month>\\d{2})(?<day>\\d{2})-(?<hours>\\d{2})(?<minutes>\\d{2})(?<seconds>\\d{2})-(?<reason>${AUTOMATIC_BACKUP_REASONS.join('|')})\\${NAME_EXTENSION}$`
)
const MONTH_OFFSET = 1
const DECIMAL_RADIX = 10

export function buildAutomaticBackupName(date: Date, reason: AutomaticBackupReason): string {
  const stamp = formatLocalDateTime(date).replaceAll('-', '').replaceAll(':', '').replace('T', '-')
  return `${NAME_PREFIX}${stamp}-${reason}${NAME_EXTENSION}`
}

export function parseAutomaticBackupName(
  name: string
): { date: Date; reason: AutomaticBackupReason } | null {
  const match = NAME_PATTERN.exec(name)
  if (!match) {
    return null
  }
  const groups = match.groups
  if (!groups) {
    return null
  }
  const toNumber = (key: string): number => Number.parseInt(groups[key] ?? '', DECIMAL_RADIX)
  const reason = AUTOMATIC_BACKUP_REASONS.find((candidate) => candidate === groups.reason)
  if (!reason) {
    return null
  }
  const date = new Date(
    toNumber('year'),
    toNumber('month') - MONTH_OFFSET,
    toNumber('day'),
    toNumber('hours'),
    toNumber('minutes'),
    toNumber('seconds')
  )
  // Reject impossible dates that the Date constructor would silently roll over
  if (buildAutomaticBackupName(date, reason) !== name) {
    return null
  }
  return { date, reason }
}
