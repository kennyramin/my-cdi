import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import type { JournalEntryViewModel } from '@frequentation/types'
import { buildEditPayload } from '../buildEditPayload'

const STUDENT_ID = 7
const OTHER_STUDENT_ID = 8

const entry: JournalEntryViewModel = {
  id: 1,
  startsAt: '2026-04-01T09:00:42',
  activity: ActivityType.WORK,
  isAnonymized: false,
  student: { id: STUDENT_ID, nom: 'A', prenom: 'B', classe: 'C', ine: 'D', displayName: 'B A' },
  activityLabel: '',
  activityColor: ''
}
const draft = {
  date: '2026-04-01',
  time: '09:00',
  studentId: STUDENT_ID,
  activity: ActivityType.WORK
}

describe('buildEditPayload', () => {
  it('sends only id and activity when nothing else changed (seconds preserved)', () => {
    expect(buildEditPayload(entry, draft, false)).toEqual({
      id: 1,
      activity: ActivityType.WORK
    })
  })

  it('sends startsAt with :00 seconds when the time changed', () => {
    expect(buildEditPayload(entry, { ...draft, time: '09:15' }, false)).toMatchObject({
      startsAt: '2026-04-01T09:15:00'
    })
  })

  it('sends startsAt when only the date changed', () => {
    expect(buildEditPayload(entry, { ...draft, date: '2026-03-31' }, false)).toMatchObject({
      startsAt: '2026-03-31T09:00:00'
    })
  })

  it('sends studentId only when it changed', () => {
    expect(buildEditPayload(entry, { ...draft, studentId: OTHER_STUDENT_ID }, false)).toMatchObject(
      { studentId: OTHER_STUDENT_ID }
    )
    expect(buildEditPayload(entry, draft, false)).not.toHaveProperty('studentId')
  })

  it('never sends studentId for an anonymized entry', () => {
    const anonymized = { ...entry, isAnonymized: true, student: { ...entry.student, id: null } }
    const payload = buildEditPayload(anonymized, { ...draft, studentId: OTHER_STUDENT_ID }, false)
    expect(payload).not.toHaveProperty('studentId')
  })

  it('adds allowDuplicates only when requested', () => {
    expect(buildEditPayload(entry, draft, true)).toMatchObject({ allowDuplicates: true })
    expect(buildEditPayload(entry, draft, false)).not.toHaveProperty('allowDuplicates')
  })
})
