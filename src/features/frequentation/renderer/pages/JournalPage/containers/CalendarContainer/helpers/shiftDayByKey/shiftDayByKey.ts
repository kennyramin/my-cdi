import dayjs from 'dayjs'

const ISO_DATE_FORMAT = 'YYYY-MM-DD'
const DAYS_PER_WEEK = 7
const DAY_OFFSET_BY_KEY: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -DAYS_PER_WEEK,
  ArrowDown: DAYS_PER_WEEK
}

export function shiftDayByKey(iso: string, key: string): string | null {
  const offset = DAY_OFFSET_BY_KEY[key]
  if (offset === undefined) {
    return null
  }
  return dayjs(iso).add(offset, 'day').format(ISO_DATE_FORMAT)
}
