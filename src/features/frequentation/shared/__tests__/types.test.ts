import { describe, it, expect } from 'vitest'
import { ActivityType } from '@types'
import { DUPLICATE_WINDOW_SECONDS, isDuplicatesFound } from '../types'
import type {
  CreateFrequentationDto,
  CreateFrequentationBatchDto,
  FrequentationResponseDto,
  JournalEntryDto,
  DateRangeDto
} from '../types'

const STUDENT_ID_1 = 1
const STUDENT_ID_2 = 2
const FREQUENTATION_ID_1 = 1
const EXPECTED_BATCH_LENGTH = 2
const DUPLICATE_WINDOW_EXPECTED = 1800

describe('Frequentation shared types', () => {
  it('CreateFrequentationDto has required fields', () => {
    const dto: CreateFrequentationDto = {
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.WORK,
      studentId: STUDENT_ID_1
    }
    expect(dto.startsAt).toBe('2026-01-15T09:00:00.000Z')
    expect(dto.activity).toBe('work')
    expect(dto.studentId).toBe(STUDENT_ID_1)
  })

  it('CreateFrequentationBatchDto wraps an array of CreateFrequentationDto', () => {
    const batch: CreateFrequentationBatchDto = {
      frequentations: [
        {
          startsAt: '2026-01-15T09:00:00.000Z',
          activity: ActivityType.WORK,
          studentId: STUDENT_ID_1
        },
        {
          startsAt: '2026-01-15T10:00:00.000Z',
          activity: ActivityType.READING,
          studentId: STUDENT_ID_2
        }
      ]
    }
    expect(batch.frequentations).toHaveLength(EXPECTED_BATCH_LENGTH)
  })

  it('FrequentationResponseDto has all fields', () => {
    const response: FrequentationResponseDto = {
      id: FREQUENTATION_ID_1,
      startsAt: '2026-01-15T09:00:00.000Z',
      activity: ActivityType.WORK,
      studentId: STUDENT_ID_1,
      studentName: 'Jean Dupont',
      studentClass: '6ème A',
      studentIne: '12345678X',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-01-15T09:00:00.000Z'
    }
    expect(response.id).toBe(FREQUENTATION_ID_1)
    expect(response.studentName).toBe('Jean Dupont')
  })

  it('JournalEntryDto has frequentation and student fields', () => {
    const entry: JournalEntryDto = {
      frequentation: {
        id: FREQUENTATION_ID_1,
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: STUDENT_ID_1,
        studentName: 'Jean Dupont',
        studentClass: '6ème A',
        studentIne: '12345678X',
        createdAt: '2026-01-15T09:00:00.000Z',
        updatedAt: '2026-01-15T09:00:00.000Z'
      },
      student: {
        id: STUDENT_ID_1,
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '6ème A',
        ine: '12345678X'
      }
    }
    expect(entry.frequentation.activity).toBe('work')
    expect(entry.student?.nom).toBe('Dupont')
  })

  it('DateRangeDto has start and end', () => {
    const range: DateRangeDto = {
      startDate: '2026-01-15',
      endDate: '2026-01-16'
    }
    expect(range.startDate).toBe('2026-01-15')
    expect(range.endDate).toBe('2026-01-16')
  })

  it('exposes a thirty minute duplicate window', () => {
    expect(DUPLICATE_WINDOW_SECONDS).toBe(DUPLICATE_WINDOW_EXPECTED)
  })

  it('isDuplicatesFound accepts a duplicates payload', () => {
    expect(isDuplicatesFound({ created: 0, duplicates: [] })).toBe(true)
  })

  it('isDuplicatesFound rejects other payloads', () => {
    expect(isDuplicatesFound({ created: 2, errors: [] })).toBe(false)
    expect(isDuplicatesFound({ created: 0 })).toBe(false)
    expect(isDuplicatesFound({ created: 1, duplicates: [] })).toBe(false)
    expect(isDuplicatesFound({ duplicates: [] })).toBe(false)
    expect(isDuplicatesFound({ created: 0, duplicates: 'x' })).toBe(false)
    expect(isDuplicatesFound({ created: 0, duplicates: {} })).toBe(false)
    expect(isDuplicatesFound('duplicates')).toBe(false)
    expect(isDuplicatesFound(0)).toBe(false)
    expect(isDuplicatesFound(true)).toBe(false)
    expect(isDuplicatesFound([])).toBe(false)
    expect(isDuplicatesFound(null)).toBe(false)
    expect(isDuplicatesFound(undefined)).toBe(false)
  })
})
