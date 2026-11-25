export const LOCAL_DATE_TIME_LENGTH = 19

export const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

const PAD_WIDTH = 2
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
