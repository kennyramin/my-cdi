import { isFutureLocalDateTime } from '@lib/localDateTime'

const SECONDS_SUFFIX = ':00'

export type EditDateTimeIssue = 'required' | 'future'

export function getEditDateTimeIssue(
  date: string,
  time: string,
  now: Date
): EditDateTimeIssue | null {
  if (!date || !time) {
    return 'required'
  }
  return isFutureLocalDateTime(`${date}T${time}${SECONDS_SUFFIX}`, now) ? 'future' : null
}
