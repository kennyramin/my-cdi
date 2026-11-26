import { describe, it, expect } from 'vitest'
import { toJournalEntryViewModel } from '../journalEntryTransformers'
import { theme } from '@ui/theme'
import { ActivityType } from '@types'
import type { JournalEntryDto } from '@frequentation-shared'

const STUDENT_ID = 7

const journalEntryDtoStub: JournalEntryDto = {
  frequentation: {
    id: 1,
    startsAt: '2026-04-01T09:00:00.000Z',
    activity: ActivityType.WORK,
    studentId: STUDENT_ID,
    studentName: 'Jean Dupont',
    studentClass: '3ème A',
    studentIne: 'INE-1',
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-04-01T09:00:00.000Z'
  },
  student: {
    id: STUDENT_ID,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: 'INE-1'
  }
}

const ANONYMIZED_LABEL = 'Élève anonymisé'

describe('toJournalEntryViewModel', () => {
  const labelLookup = (a: ActivityType) => `LABEL_${a}`

  it('maps a normal entry unchanged', () => {
    const result = toJournalEntryViewModel(
      journalEntryDtoStub,
      labelLookup,
      theme.palette.activity,
      ANONYMIZED_LABEL
    )

    expect(result.isAnonymized).toBe(false)
    expect(result.student.id).toBe(STUDENT_ID)

    expect(result.id).toBe(1)
    expect(result.activity).toBe(ActivityType.WORK)
    expect(result.student.displayName).toBe('Jean Dupont')
    expect(result.activityLabel).toBe(`LABEL_${ActivityType.WORK}`)
    expect(result.activityColor).toMatch(/^#/)
  })

  it('maps student: null to an anonymized view model with the snapshot class and i18n label', () => {
    const result = toJournalEntryViewModel(
      {
        frequentation: {
          ...journalEntryDtoStub.frequentation,
          studentId: null,
          studentClass: '5C'
        },
        student: null
      },
      labelLookup,
      theme.palette.activity,
      ANONYMIZED_LABEL
    )

    expect(result.isAnonymized).toBe(true)
    expect(result.student).toEqual({
      id: null,
      nom: '',
      prenom: '',
      classe: '5C',
      ine: '',
      displayName: ANONYMIZED_LABEL
    })
  })
})
