import { describe, it, expect } from 'vitest'
import i18n from '@shared/i18n/config'
import { formatDuplicateLine } from '../formatDuplicateLine'
import { ActivityType } from '@types'

const STUDENT_ID = 4

function dto(existingStartsAt: string) {
  return {
    studentId: STUDENT_ID,
    studentName: 'Léa Martin',
    existingStartsAt,
    existingActivity: ActivityType.READING
  }
}

describe('formatDuplicateLine', () => {
  const t = i18n.getFixedT('fr', 'frequentation')

  it('formats the time as HH:mm taken from the string', () => {
    expect(formatDuplicateLine(dto('2026-04-01T14:02:00'), 'Lecture', t)).toBe(
      'Léa Martin — déjà enregistrée à 14:02 (Lecture)'
    )
  })

  it('keeps the zero padding', () => {
    expect(formatDuplicateLine(dto('2026-04-01T09:05:00'), 'Lecture', t)).toBe(
      'Léa Martin — déjà enregistrée à 09:05 (Lecture)'
    )
  })
})
