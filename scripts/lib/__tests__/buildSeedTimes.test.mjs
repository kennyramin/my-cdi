import { describe, expect, it } from 'vitest'
import { buildSeedTimes } from '../buildSeedTimes.mjs'

const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/
const WANTED = 30

describe('buildSeedTimes', () => {
  it('returns 30 strings strictly before now at 12:34:56', () => {
    const times = buildSeedTimes(new Date(2026, 10, 26, 12, 34, 56), WANTED)
    expect(times).toHaveLength(WANTED)
    expect(times[0]).toBe('2026-11-26T00:00:00')
    expect(times[1]).toBe('2026-11-26T00:01:00')
    expect(times[WANTED - 1]).toBe('2026-11-26T00:29:00')
    times.forEach((time) => expect(time < '2026-11-26T12:34:00').toBe(true))
  })

  it('keeps the local date of now, not the UTC date', () => {
    const times = buildSeedTimes(new Date(2026, 10, 26, 0, 40), WANTED)
    expect(times.length).toBeGreaterThan(0)
    times.forEach((time) => expect(time.startsWith('2026-11-26')).toBe(true))
  })

  it('returns fewer than wanted early in the day', () => {
    const times = buildSeedTimes(new Date(2026, 10, 26, 0, 10), WANTED)
    expect(times).toHaveLength(9)
    expect(times[8]).toBe('2026-11-26T00:08:00')
  })

  it('returns an empty list at 00:00:30', () => {
    expect(buildSeedTimes(new Date(2026, 10, 26, 0, 0, 30), WANTED)).toEqual([])
  })

  it('never returns a string equal to or after now truncated to the minute', () => {
    const now = new Date(2026, 10, 26, 0, 31, 59)
    const limit = '2026-11-26T00:31:00'
    const times = buildSeedTimes(now, WANTED)
    expect(times).toHaveLength(WANTED)
    times.forEach((time) => expect(time < limit).toBe(true))
  })

  it('on the spring-forward day (2027-03-28) at 03:30 returns strictly increasing strings and none after now', () => {
    const times = buildSeedTimes(new Date(2027, 2, 28, 3, 30), WANTED)
    expect(times.length).toBeGreaterThan(0)
    times.forEach((time, index) => {
      expect(time < '2027-03-28T03:30:00').toBe(true)
      if (index > 0) {
        expect(time > times[index - 1]).toBe(true)
      }
    })
  })

  it('format matches the main-process local date-time pattern', () => {
    buildSeedTimes(new Date(2026, 10, 26, 12, 34, 56), WANTED).forEach((time) =>
      expect(time).toMatch(FORMAT)
    )
  })
})
