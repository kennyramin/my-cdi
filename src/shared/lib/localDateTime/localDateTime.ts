/** Length of a local date-time string, `YYYY-MM-DDTHH:mm:ss`. */
export const LOCAL_DATE_TIME_LENGTH = 19

const PAD_WIDTH = 2
const MONTH_OFFSET = 1

const pad = (value: number): string => String(value).padStart(PAD_WIDTH, '0')

/** Local calendar date as `YYYY-MM-DD`. */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + MONTH_OFFSET)}-${pad(date.getDate())}`
}

/** Local date-time as `YYYY-MM-DDTHH:mm:ss` (no timezone suffix). */
export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** True when the `YYYY-MM-DD` date is after today's local date. */
export function isFutureLocalDate(isoDate: string, now: Date): boolean {
  return isoDate > formatLocalDate(now)
}

/** True when the local start time is after `now` (fixed-width lexicographic comparison). */
export function isFutureLocalDateTime(startsAt: string, now: Date): boolean {
  return startsAt.slice(0, LOCAL_DATE_TIME_LENGTH) > formatLocalDateTime(now)
}
