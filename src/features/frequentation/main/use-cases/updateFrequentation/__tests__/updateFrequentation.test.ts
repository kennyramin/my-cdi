import { describe, it, expect, vi } from 'vitest'
import { ActivityType } from '@types'
import { updateFrequentation } from '../updateFrequentation'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type {
  FrequentationEntity,
  FrequentationWithStudentEntity
} from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'
import { ErrorCode } from '@lib/errors'

const NONEXISTENT_ID = 999
const NOW = new Date('2026-01-15T12:00:00')
const NOW_LOCAL = '2026-01-15T12:00:00'
const FUTURE_LOCAL = '2026-01-15T12:00:01'
const PAST_SCHOOL_YEAR_LOCAL = '2024-10-02T09:00:00'
const STUDENT_ID = 1
const OTHER_STUDENT_ID = 2
const UNKNOWN_STUDENT_ID = 42

const EXISTING_ENTITY: FrequentationEntity = {
  id: 1,
  startsAt: '2026-01-15T09:00:00',
  activity: ActivityType.WORK,
  studentId: STUDENT_ID,
  studentClasse: null,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z'
}

const UPDATED_ENTITY: FrequentationEntity = {
  ...EXISTING_ENTITY,
  activity: ActivityType.READING,
  updatedAt: '2026-01-15T10:00:00.000Z'
}

const UPDATED_WITH_STUDENT: FrequentationWithStudentEntity = {
  ...UPDATED_ENTITY,
  studentNom: 'Dupont',
  studentPrenom: 'Marie',
  studentClasse: '6A',
  studentIne: null
}

function createStudent(id: number, prenom: string, nom: string): StudentEntity {
  return {
    id,
    prenom,
    nom,
    classe: '6A',
    ine: `INE${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function createMockGateway(overrides: Partial<FrequentationGateway> = {}): FrequentationGateway {
  return {
    create: vi.fn(),
    getById: vi.fn().mockResolvedValue(EXISTING_ENTITY),
    getAll: vi.fn().mockResolvedValue([]),
    getByStudentId: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(false),
    deleteByStudentId: vi.fn().mockResolvedValue(0),
    createManyChecked: vi.fn(),
    updateChecked: vi.fn().mockResolvedValue({ written: UPDATED_ENTITY }),
    getWithStudentById: vi.fn().mockResolvedValue(UPDATED_WITH_STUDENT),
    count: vi.fn().mockResolvedValue(0),
    ...overrides
  }
}

function createMockStudentGateway(overrides: Partial<StudentGateway> = {}): StudentGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByIds: vi
      .fn()
      .mockResolvedValue([
        createStudent(STUDENT_ID, 'Marie', 'Dupont'),
        createStudent(OTHER_STUDENT_ID, 'Paul', 'Martin')
      ]),
    getAllWithVisitCount: vi.fn(),
    countVisitsByStudentId: vi.fn(),
    anonymizeByIds: vi.fn(),
    checkpoint: vi.fn(),
    withTransaction: vi.fn(),
    ...overrides
  }
}

describe('updateFrequentation', () => {
  it('updates an entry and re-reads it with its student', async () => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { activity: ActivityType.READING },
      NOW
    )
    expect(result).toEqual({ success: true, data: { updated: UPDATED_WITH_STUDENT } })
    expect(gateway.getWithStudentById).toHaveBeenCalledWith(1)
  })

  it('returns FREQUENTATION_NOT_FOUND for an unknown id', async () => {
    const gateway = createMockGateway({ getById: vi.fn().mockResolvedValue(null) })
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      NONEXISTENT_ID,
      { activity: ActivityType.READING },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.FREQUENTATION_NOT_FOUND })
  })

  it.each([
    '2026-01-15 09:00',
    '2026-01-15T09:00',
    '2026-01-15T09:00:00Z',
    '2026-01-15T09:00:00.000'
  ])('rejects malformed startsAt %s without writing', async (startsAt) => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { startsAt },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(gateway.updateChecked).not.toHaveBeenCalled()
  })

  it('rejects a startsAt in the future', async () => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { startsAt: FUTURE_LOCAL },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(gateway.updateChecked).not.toHaveBeenCalled()
  })

  it('accepts a startsAt equal to now', async () => {
    const result = await updateFrequentation(
      createMockGateway(),
      createMockStudentGateway(),
      1,
      { startsAt: NOW_LOCAL },
      NOW
    )
    expect(result.success).toBe(true)
  })

  it('accepts a startsAt in a past school year', async () => {
    const result = await updateFrequentation(
      createMockGateway(),
      createMockStudentGateway(),
      1,
      { startsAt: PAST_SCHOOL_YEAR_LOCAL },
      NOW
    )
    expect(result.success).toBe(true)
  })

  it('rejects an invalid activity', async () => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      // Untrusted IPC payload
      JSON.parse('{"activity":"not-an-activity"}'),
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(gateway.updateChecked).not.toHaveBeenCalled()
  })

  it.each([0, Number.MIN_SAFE_INTEGER])('rejects studentId %s', async (studentId) => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { studentId },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(gateway.updateChecked).not.toHaveBeenCalled()
  })

  it('returns STUDENT_NOT_FOUND when the student does not exist', async () => {
    const gateway = createMockGateway()
    const studentGateway = createMockStudentGateway({ getByIds: vi.fn().mockResolvedValue([]) })
    const result = await updateFrequentation(
      gateway,
      studentGateway,
      1,
      { studentId: UNKNOWN_STUDENT_ID },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.STUDENT_NOT_FOUND })
    expect(gateway.updateChecked).not.toHaveBeenCalled()
  })

  it('moves the entry to another existing student', async () => {
    const gateway = createMockGateway()
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { studentId: OTHER_STUDENT_ID },
      NOW
    )
    expect(result.success).toBe(true)
    expect(gateway.updateChecked).toHaveBeenCalledWith(
      1,
      { studentId: OTHER_STUDENT_ID },
      { allowDuplicates: false }
    )
  })

  describe('anonymized visit (stored student_id is NULL)', () => {
    const ANONYMIZED_ENTITY: FrequentationEntity = { ...EXISTING_ENTITY, studentId: null }

    it('refuses to link it to a student again', async () => {
      const gateway = createMockGateway({ getById: vi.fn().mockResolvedValue(ANONYMIZED_ENTITY) })
      const result = await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { studentId: STUDENT_ID },
        NOW
      )
      expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
      expect(gateway.updateChecked).not.toHaveBeenCalled()
    })

    it('accepts a time and activity edit', async () => {
      const gateway = createMockGateway({ getById: vi.fn().mockResolvedValue(ANONYMIZED_ENTITY) })
      const result = await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { startsAt: PAST_SCHOOL_YEAR_LOCAL, activity: ActivityType.READING },
        NOW
      )
      expect(result.success).toBe(true)
    })
  })

  describe('duplicates', () => {
    const MATCH = {
      studentId: STUDENT_ID,
      existingId: 7,
      existingStartsAt: '2026-01-15T09:10:00',
      existingActivity: ActivityType.GAME
    }

    it('returns warnings with the student name and existing visit', async () => {
      const gateway = createMockGateway({
        updateChecked: vi.fn().mockResolvedValue({ duplicates: [MATCH] })
      })
      const result = await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { startsAt: '2026-01-15T09:05:00' },
        NOW
      )
      expect(result).toEqual({
        success: true,
        data: {
          duplicates: [
            {
              studentId: STUDENT_ID,
              studentName: 'Marie Dupont',
              existingStartsAt: MATCH.existingStartsAt,
              existingActivity: ActivityType.GAME
            }
          ]
        }
      })
      expect(gateway.getWithStudentById).not.toHaveBeenCalled()
    })

    it('lists a visit matched several times only once', async () => {
      const gateway = createMockGateway({
        updateChecked: vi.fn().mockResolvedValue({ duplicates: [MATCH, MATCH] })
      })
      const result = await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { startsAt: '2026-01-15T09:05:00' },
        NOW
      )
      expect(result.success && 'duplicates' in result.data && result.data.duplicates).toHaveLength(
        1
      )
    })

    it('forwards allowDuplicates to the gateway', async () => {
      const gateway = createMockGateway()
      await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { startsAt: '2026-01-15T09:05:00', allowDuplicates: true },
        NOW
      )
      expect(gateway.updateChecked).toHaveBeenCalledWith(
        1,
        { startsAt: '2026-01-15T09:05:00' },
        { allowDuplicates: true }
      )
    })

    it('passes an activity-only edit through with allowDuplicates unchanged', async () => {
      const gateway = createMockGateway()
      await updateFrequentation(
        gateway,
        createMockStudentGateway(),
        1,
        { activity: ActivityType.READING },
        NOW
      )
      expect(gateway.updateChecked).toHaveBeenCalledWith(
        1,
        { activity: ActivityType.READING },
        { allowDuplicates: false }
      )
    })
  })

  it('returns FREQUENTATION_NOT_FOUND when the entry is deleted meanwhile', async () => {
    const gateway = createMockGateway({
      updateChecked: vi.fn().mockResolvedValue({ written: null })
    })
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { activity: ActivityType.READING },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.FREQUENTATION_NOT_FOUND })
  })

  it('returns DATABASE_ERROR when the gateway throws', async () => {
    const gateway = createMockGateway({
      updateChecked: vi.fn().mockRejectedValue(new Error('Update failed'))
    })
    const result = await updateFrequentation(
      gateway,
      createMockStudentGateway(),
      1,
      { activity: ActivityType.READING },
      NOW
    )
    expect(result).toMatchObject({ success: false, code: ErrorCode.DATABASE_ERROR })
  })
})
