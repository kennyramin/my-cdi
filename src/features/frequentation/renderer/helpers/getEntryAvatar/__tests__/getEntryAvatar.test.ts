import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import type { JournalEntryViewModel } from '@frequentation/types'
import { getEntryAvatar } from '../getEntryAvatar'

const STUDENT_ID = 7

const identifiedEntry: JournalEntryViewModel = {
  id: 1,
  startsAt: '2026-01-15T09:00:00',
  activity: ActivityType.WORK,
  isAnonymized: false,
  student: {
    id: STUDENT_ID,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: '12345678X',
    displayName: 'Jean Dupont'
  },
  activityLabel: 'Travail',
  activityColor: '#000000'
}

const anonymizedEntry: JournalEntryViewModel = {
  ...identifiedEntry,
  isAnonymized: true,
  student: {
    ...identifiedEntry.student,
    id: null,
    nom: '',
    prenom: '',
    displayName: 'Élève anonymisé'
  }
}

describe('getEntryAvatar', () => {
  it('uses the student initials and id for an identified entry', () => {
    expect(getEntryAvatar(identifiedEntry)).toEqual({
      initials: 'JD',
      colorSeed: STUDENT_ID,
      neutral: false
    })
  })

  it('uses a neutral question mark and no color seed for an anonymized entry', () => {
    expect(getEntryAvatar(anonymizedEntry)).toEqual({
      initials: '?',
      colorSeed: null,
      neutral: true
    })
  })
})
