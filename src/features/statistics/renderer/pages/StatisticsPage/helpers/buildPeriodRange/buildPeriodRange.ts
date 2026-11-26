import { formatLocalDate } from '@lib/localDateTime'
import type { PeriodRangeDto } from '@statistics-shared'
import type { PresetPeriodKey } from '@statistics/types'

const FIRST_DAY = 1
const MONTH_OFFSET = 1
const QUARTER_LENGTH = 3
const SEMESTER_LENGTH = 6
const DAYS_IN_WEEK = 7
const SUNDAY = 0
const SCHOOL_YEAR_START_MONTH = 8
const SCHOOL_YEAR_START_DAY = '09-01'
const SCHOOL_YEAR_END_DAY = '08-31'
const YEAR_OFFSET = 1

function toRange(start: Date, end: Date): PeriodRangeDto {
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) }
}

function buildWeekRange(today: Date): PeriodRangeDto {
  const dayOfWeek = today.getDay()
  const offset = dayOfWeek === SUNDAY ? DAYS_IN_WEEK - MONTH_OFFSET : dayOfWeek - MONTH_OFFSET
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (DAYS_IN_WEEK - MONTH_OFFSET)
  )
  return toRange(start, end)
}

function buildMonthRange(today: Date): PeriodRangeDto {
  const year = today.getFullYear()
  const month = today.getMonth()
  return toRange(new Date(year, month, FIRST_DAY), new Date(year, month + MONTH_OFFSET, 0))
}

function buildQuarterRange(today: Date): PeriodRangeDto {
  const year = today.getFullYear()
  const month = today.getMonth()
  const startMonth = month - (month % QUARTER_LENGTH)
  return toRange(
    new Date(year, startMonth, FIRST_DAY),
    new Date(year, startMonth + QUARTER_LENGTH, 0)
  )
}

function buildSemesterRange(today: Date): PeriodRangeDto {
  const year = today.getFullYear()
  const month = today.getMonth()
  const startMonth = month - (month % SEMESTER_LENGTH)
  return toRange(
    new Date(year, startMonth, FIRST_DAY),
    new Date(year, startMonth + SEMESTER_LENGTH, 0)
  )
}

function buildSchoolYearRange(today: Date): PeriodRangeDto {
  const year = today.getFullYear()
  const startYear = today.getMonth() >= SCHOOL_YEAR_START_MONTH ? year : year - YEAR_OFFSET
  return {
    startDate: `${startYear}-${SCHOOL_YEAR_START_DAY}`,
    endDate: `${startYear + YEAR_OFFSET}-${SCHOOL_YEAR_END_DAY}`
  }
}

export function buildPeriodRange(key: PresetPeriodKey, today: Date = new Date()): PeriodRangeDto {
  if (key === 'week') {
    return buildWeekRange(today)
  }
  if (key === 'quarter') {
    return buildQuarterRange(today)
  }
  if (key === 'semester') {
    return buildSemesterRange(today)
  }
  if (key === 'schoolYear') {
    return buildSchoolYearRange(today)
  }
  return buildMonthRange(today)
}
