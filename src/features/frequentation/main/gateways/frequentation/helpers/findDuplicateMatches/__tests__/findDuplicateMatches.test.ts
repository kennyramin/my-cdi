import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import { findDuplicateMatches } from '../findDuplicateMatches'

const STUDENT = 1
const OTHER_STUDENT = 2
const FIRST_ID = 10
const SECOND_ID = 11
const BASE = '2026-01-15T10:00:00'

const existing = (
  startsAt: string,
  overrides: Partial<{ id: number; studentId: number | null; activity: ActivityType }> = {}
) => ({
  id: FIRST_ID,
  studentId: STUDENT,
  startsAt,
  activity: ActivityType.WORK,
  ...overrides
})

describe('findDuplicateMatches', () => {
  it('matches an entry 29 minutes away', () => {
    const result = findDuplicateMatches(
      [{ studentId: STUDENT, startsAt: BASE }],
      [existing('2026-01-15T10:29:00')]
    )
    expect(result).toEqual([
      {
        studentId: STUDENT,
        existingId: FIRST_ID,
        existingStartsAt: '2026-01-15T10:29:00',
        existingActivity: ActivityType.WORK
      }
    ])
  })

  it('does not match an entry exactly 30 minutes away', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: BASE }],
        [existing('2026-01-15T10:30:00')]
      )
    ).toEqual([])
  })

  it('does not match an entry 31 minutes away', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: BASE }],
        [existing('2026-01-15T10:31:00')]
      )
    ).toEqual([])
  })

  it('matches an entry 29 minutes 59 seconds away', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: BASE }],
        [existing('2026-01-15T10:29:59')]
      )
    ).toHaveLength(1)
  })

  it('ignores the same student on another day even a few minutes apart', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: '2026-01-15T23:50:00' }],
        [existing('2026-01-16T00:10:00')]
      )
    ).toEqual([])
  })

  it('ignores the activity of the existing entry', () => {
    const result = findDuplicateMatches(
      [{ studentId: STUDENT, startsAt: BASE }],
      [existing(BASE, { activity: ActivityType.READING })]
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.existingActivity).toBe(ActivityType.READING)
  })

  it('ignores the excluded entry', () => {
    expect(
      findDuplicateMatches([{ studentId: STUDENT, startsAt: BASE }], [existing(BASE)], FIRST_ID)
    ).toEqual([])
  })

  it('ignores existing rows without a student', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: BASE }],
        [existing(BASE, { studentId: null })]
      )
    ).toEqual([])
  })

  it('ignores other students', () => {
    expect(
      findDuplicateMatches(
        [{ studentId: STUDENT, startsAt: BASE }],
        [existing(BASE, { studentId: OTHER_STUDENT })]
      )
    ).toEqual([])
  })

  it('returns every existing entry near a candidate', () => {
    const result = findDuplicateMatches(
      [{ studentId: STUDENT, startsAt: BASE }],
      [existing('2026-01-15T09:50:00'), existing('2026-01-15T10:10:00', { id: SECOND_ID })]
    )
    expect(result.map((match) => match.existingId)).toEqual([FIRST_ID, SECOND_ID])
  })
})
