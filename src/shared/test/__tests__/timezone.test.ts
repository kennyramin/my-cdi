import { it, expect } from 'vitest'

const WINTER_OFFSET_MINUTES = -60
const SUMMER_OFFSET_MINUTES = -120
const YEAR = 2026
const NOVEMBER = 10
const JUNE = 5
const NOVEMBER_DAY = 25
const JUNE_DAY = 10
const NOON = 12

it('runs the suite in Europe/Paris', () => {
  expect(process.env.TZ).toBe('Europe/Paris')
  expect(new Date(YEAR, NOVEMBER, NOVEMBER_DAY, NOON).getTimezoneOffset()).toBe(
    WINTER_OFFSET_MINUTES
  )
  expect(new Date(YEAR, JUNE, JUNE_DAY, NOON).getTimezoneOffset()).toBe(SUMMER_OFFSET_MINUTES)
})
