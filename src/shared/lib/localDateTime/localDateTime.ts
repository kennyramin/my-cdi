export const LOCAL_DATE_TIME_LENGTH = 19

export const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

const PAD_WIDTH = 2
const DATE_PART_LENGTH = 10
const TIME_PART_START = 11
const HOURS_END = 13
const MINUTES_START = 14
const MINUTES_END = 16
const SECONDS_START = 17
const SECONDS_END = 19
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const MONTH_OFFSET = 1

const pad = (value: number): string => String(value).padStart(PAD_WIDTH, '0')

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + MONTH_OFFSET)}-${pad(date.getDate())}`
}

export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function isFutureLocalDate(isoDate: string, now: Date): boolean {
  return isoDate > formatLocalDate(now)
}

export function isFutureLocalDateTime(startsAt: string, now: Date): boolean {
  return startsAt.slice(0, LOCAL_DATE_TIME_LENGTH) > formatLocalDateTime(now)
}

const secondsOfDay = (value: string): number =>
  Number(value.slice(TIME_PART_START, HOURS_END)) * SECONDS_PER_HOUR +
  Number(value.slice(MINUTES_START, MINUTES_END)) * SECONDS_PER_MINUTE +
  Number(value.slice(SECONDS_START, SECONDS_END))

/**
 * Absolute distance in seconds between two local wall-clock strings of the same day, or `null`
 * when they fall on different days.
 *
 * Precondition: both values already match `LOCAL_DATE_TIME_PATTERN` (`YYYY-MM-DDTHH:mm:ss`);
 * inputs are validated upstream and are not re-checked here. Anything after the seconds is ignored.
 */
export function localSameDayDistanceSeconds(a: string, b: string): number | null {
  if (a.slice(0, DATE_PART_LENGTH) !== b.slice(0, DATE_PART_LENGTH)) {
    return null
  }
  return Math.abs(secondsOfDay(a) - secondsOfDay(b))
}
