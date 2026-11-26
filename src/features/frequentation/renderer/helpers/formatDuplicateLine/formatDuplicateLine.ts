import type { TFunction } from 'i18next'
import type { DuplicateWarningDto } from '@frequentation-shared'

const TIME_START = 11
const TIME_END = 16

// existingStartsAt is a local ISO string (YYYY-MM-DDTHH:mm:ss, no zone): slice, never parse as Date.
export function formatDuplicateLine(
  dto: DuplicateWarningDto,
  activityLabel: string,
  t: TFunction<'frequentation'>
): string {
  return t('duplicate.line', {
    name: dto.studentName,
    time: dto.existingStartsAt.slice(TIME_START, TIME_END),
    activity: activityLabel
  })
}
