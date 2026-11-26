import { formatLocalDateTime } from '@lib/localDateTime'
import { AUTOMATIC_BACKUP_REASONS, type AutomaticBackupReason } from '@backup-shared'

const NAME_PREFIX = 'auto-'
const NAME_EXTENSION = '.db'
const NAME_PATTERN = new RegExp(
  `^${NAME_PREFIX}(\\d{4})(\\d{2})(\\d{2})-(\\d{2})(\\d{2})(\\d{2})-(${AUTOMATIC_BACKUP_REASONS.join('|')})\\${NAME_EXTENSION}$`
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
  const [year = 0, month = 0, day = 0, hours = 0, minutes = 0, seconds = 0] = match
    .slice(1, 7)
    .map((part) => Number.parseInt(part, DECIMAL_RADIX))
  const reason = AUTOMATIC_BACKUP_REASONS.find((candidate) => candidate === match[7])
  if (!reason) {
    return null
  }
  const date = new Date(year, month - MONTH_OFFSET, day, hours, minutes, seconds)
  // Reject impossible dates that the Date constructor would silently roll over
  if (buildAutomaticBackupName(date, reason) !== name) {
    return null
  }
  return { date, reason }
}
