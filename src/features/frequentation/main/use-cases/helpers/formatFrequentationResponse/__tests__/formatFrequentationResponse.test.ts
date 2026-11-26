import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import { formatFrequentationResponse } from '../formatFrequentationResponse'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'

const SECOND_ID = 2

describe('formatFrequentationResponse', () => {
  it('maps FrequentationWithStudentEntity to FrequentationResponseDto', () => {
    const entity: FrequentationWithStudentEntity = {
      id: 1,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.WORK,
      studentId: 1,
      studentNom: 'Dupont',
      studentPrenom: 'Jean',
      studentClasse: '6ème A',
      studentIne: '12345678X',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    }

    const result = formatFrequentationResponse(entity)

    expect(result).toEqual({
      id: 1,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: 'work',
      studentId: 1,
      studentName: 'Jean Dupont',
      studentClass: '6ème A',
      studentIne: '12345678X',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    })
  })

  it('formats studentName as "prenom nom"', () => {
    const entity: FrequentationWithStudentEntity = {
      id: SECOND_ID,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.READING,
      studentId: SECOND_ID,
      studentNom: 'Martin',
      studentPrenom: 'Marie',
      studentClasse: '5ème B',
      studentIne: '87654321Y',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    }

    const result = formatFrequentationResponse(entity)
    expect(result.studentName).toBe('Marie Martin')
  })

  it('formats an anonymized entry with the label and snapshot class', () => {
    const entity: FrequentationWithStudentEntity = {
      id: 3,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.WORK,
      studentId: null,
      studentNom: null,
      studentPrenom: null,
      studentClasse: '6ème A',
      studentIne: null,
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    }

    const result = formatFrequentationResponse(entity)

    expect(result.studentId).toBeNull()
    expect(result.studentName).toBe(ANONYMIZED_STUDENT_LABEL)
    expect(result.studentClass).toBe('6ème A')
    expect(result.studentIne).toBe('')
  })

  it('keeps identity for a normal entry', () => {
    const entity: FrequentationWithStudentEntity = {
      id: 4,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.WORK,
      studentId: 1,
      studentNom: 'Dupont',
      studentPrenom: 'Jean',
      studentClasse: '6ème A',
      studentIne: '12345678X',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    }

    const result = formatFrequentationResponse(entity)

    expect(result.studentId).toBe(1)
    expect(result.studentName).toBe('Jean Dupont')
    expect(result.studentIne).toBe('12345678X')
  })
})
