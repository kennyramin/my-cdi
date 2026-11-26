import { describe, it, expect, vi } from 'vitest'
import { ActivityType } from '@types'
import { getJournalEntries } from '../getJournalEntries'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type {
  FrequentationWithStudentEntity,
  FrequentationEntity
} from '@frequentation/entities/frequentation'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { DateRangeDto } from '@frequentation-shared'

const MISSING_STUDENT_ID = 999

const FALLBACK_ENTITY: FrequentationEntity = {
  id: 0,
  startsAt: '2026-01-15T09:00:00.000Z',
  activity: ActivityType.WORK,
  studentId: 1,
  studentClasse: null,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z'
}

const FREQUENTATION_ENTITY: FrequentationWithStudentEntity = {
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

function createMockFrequentationGateway(
  overrides: Partial<FrequentationGateway> = {}
): FrequentationGateway {
  return {
    create: vi.fn().mockResolvedValue(FALLBACK_ENTITY),
    getById: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([FREQUENTATION_ENTITY]),
    getByStudentId: vi.fn().mockResolvedValue([FREQUENTATION_ENTITY]),
    getByDateRange: vi.fn().mockResolvedValue([FREQUENTATION_ENTITY]),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    deleteByStudentId: vi.fn().mockResolvedValue(0),
    createManyChecked: vi.fn(),
    updateChecked: vi.fn(),
    getWithStudentById: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    ...overrides
  }
}

describe('getJournalEntries', () => {
  it('returns journal entries for a date range', async () => {
    const frequentationGateway = createMockFrequentationGateway()
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      const entry = result.data[0]
      expect(entry?.frequentation.id).toBe(1)
      expect(entry?.student?.nom).toBe('Dupont')
    }
  })

  it('returns empty array when no frequentations in range', async () => {
    const frequentationGateway = createMockFrequentationGateway({
      getByDateRange: vi.fn().mockResolvedValue([])
    })
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(0)
    }
  })

  it('returns error when frequentation gateway throws', async () => {
    const frequentationGateway = createMockFrequentationGateway({
      getByDateRange: vi.fn().mockRejectedValue(new Error('DB error'))
    })
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('DB error')
    }
  })

  it('returns student: null for an anonymized entry', async () => {
    const anonymized: FrequentationWithStudentEntity = {
      ...FREQUENTATION_ENTITY,
      studentId: null,
      studentNom: null,
      studentPrenom: null,
      studentIne: null
    }
    const frequentationGateway = createMockFrequentationGateway({
      getByDateRange: vi.fn().mockResolvedValue([anonymized])
    })
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]?.student).toBeNull()
      expect(result.data[0]?.frequentation.studentName).toBe(ANONYMIZED_STUDENT_LABEL)
      expect(result.data[0]?.frequentation.studentClass).toBe('6ème A')
    }
  })

  it('returns student: null for an orphan row whose student is gone', async () => {
    const orphan: FrequentationWithStudentEntity = {
      ...FREQUENTATION_ENTITY,
      studentId: MISSING_STUDENT_ID,
      studentNom: null,
      studentPrenom: null,
      studentIne: null
    }
    const frequentationGateway = createMockFrequentationGateway({
      getByDateRange: vi.fn().mockResolvedValue([orphan])
    })
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]?.student).toBeNull()
    }
  })

  it('still returns the student for a normal entry', async () => {
    const frequentationGateway = createMockFrequentationGateway()
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]?.student).toEqual({
        id: 1,
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '6ème A',
        ine: '12345678X'
      })
    }
  })

  it('reports the class carried by the visit, not a later class of the student', async () => {
    const snapshotClass = '5ème B'
    const visitInPreviousClass: FrequentationWithStudentEntity = {
      ...FREQUENTATION_ENTITY,
      studentClasse: snapshotClass
    }
    const frequentationGateway = createMockFrequentationGateway({
      getByDateRange: vi.fn().mockResolvedValue([visitInPreviousClass])
    })
    const dateRange: DateRangeDto = { startDate: '2026-01-15', endDate: '2026-01-15' }

    const result = await getJournalEntries(frequentationGateway, dateRange)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]?.student?.classe).toBe(snapshotClass)
      expect(result.data[0]?.frequentation.studentClass).toBe(snapshotClass)
    }
  })
})
