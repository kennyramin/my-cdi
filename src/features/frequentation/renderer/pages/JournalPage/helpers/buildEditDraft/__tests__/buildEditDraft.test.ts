import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import type { JournalEntryViewModel } from '@frequentation/types'
import { buildEditDraft } from '../buildEditDraft'

const entry: JournalEntryViewModel = {
  id: 1,
  startsAt: '2026-04-01T09:05:42',
  activity: ActivityType.READING,
  isAnonymized: false,
  student: { id: 7, nom: 'A', prenom: 'B', classe: 'C', ine: 'D', displayName: 'B A' },
  activityLabel: '',
  activityColor: ''
}

describe('buildEditDraft', () => {
  it('splits the stored local string into date and HH:mm time', () => {
    expect(buildEditDraft(entry)).toEqual({
      date: '2026-04-01',
      time: '09:05',
      studentId: 7,
      activity: ActivityType.READING
    })
  })

  it('tolerates a trailing millisecond/Z suffix', () => {
    expect(buildEditDraft({ ...entry, startsAt: '2026-04-01T23:59:00.000Z' }).time).toBe('23:59')
  })

  it('keeps a null studentId for an anonymized entry', () => {
    const draft = buildEditDraft({ ...entry, student: { ...entry.student, id: null } })
    expect(draft.studentId).toBeNull()
  })
})
