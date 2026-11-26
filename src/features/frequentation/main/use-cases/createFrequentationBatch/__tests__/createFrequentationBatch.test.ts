import { describe, it, expect, vi } from 'vitest'
import { ActivityType } from '@types'
import { createFrequentationBatch } from '../createFrequentationBatch'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { FrequentationEntity } from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { DuplicateMatch } from '@frequentation/gateways/frequentation'
import { ErrorCode } from '@lib/errors'

const SECOND_STUDENT_ID = 2
const UNKNOWN_STUDENT_ID = 42
const EXPECTED_TWO = 2

const TEST_YEAR = 2026
const TEST_MONTH_INDEX = 10
const TEST_DAY = 25
const NOW_HOUR = 14
const NOW_MINUTE = 30
const NOW = new Date(TEST_YEAR, TEST_MONTH_INDEX, TEST_DAY, NOW_HOUR, NOW_MINUTE)

const VALID_ENTITY: FrequentationEntity = {
  id: 1,
  startsAt: '2026-01-15T09:00:00',
  activity: ActivityType.WORK,
  studentId: 1,
  studentClasse: null,
  createdAt: '2026-01-15T09:00:00',
  updatedAt: '2026-01-15T09:00:00'
}

function createMockGateway(overrides: Partial<FrequentationGateway> = {}): FrequentationGateway {
  return {
    create: vi.fn(),
    getById: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    getByStudentId: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    deleteByStudentId: vi.fn().mockResolvedValue(0),
    createManyChecked: vi
      .fn()
      .mockImplementation((items: unknown[]) =>
        Promise.resolve({ written: items.map(() => VALID_ENTITY) })
      ),
    updateChecked: vi.fn(),
    getWithStudentById: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    ...overrides
  }
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
        createStudent(1, 'Marie', 'Dupont'),
        createStudent(SECOND_STUDENT_ID, 'Paul', 'Martin')
      ]),
    getAllWithVisitCount: vi.fn(),
    countVisitsByStudentId: vi.fn(),
    anonymizeByIds: vi.fn(),
    checkpoint: vi.fn(),
    withTransaction: vi.fn(),
    ...overrides
  }
}

const ITEM_ONE = { startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: 1 }
const ITEM_TWO = {
  startsAt: '2026-01-15T10:00:00',
  activity: ActivityType.READING,
  studentId: SECOND_STUDENT_ID
}

function duplicateOf(studentId: number, existingId: number): DuplicateMatch {
  return {
    studentId,
    existingId,
    existingStartsAt: '2026-01-15T09:10:00',
    existingActivity: ActivityType.GAME
  }
}

describe('createFrequentationBatch', () => {
  it('creates all items through a single createManyChecked call', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [ITEM_ONE, ITEM_TWO] },
      NOW
    )
    expect(result.success).toBe(true)
    if (result.success && 'created' in result.data) {
      expect(result.data.created).toHaveLength(EXPECTED_TWO)
      expect(result.data.errors).toHaveLength(0)
    }
    expect(gateway.createManyChecked).toHaveBeenCalledTimes(1)
    expect(gateway.createManyChecked).toHaveBeenCalledWith([ITEM_ONE, ITEM_TWO], {
      allowDuplicates: false
    })
    expect(gateway.create).not.toHaveBeenCalled()
  })

  it('returns the duplicate with name, time and activity for a single student', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi.fn().mockResolvedValue({ duplicates: [duplicateOf(1, 7)] })
    })
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [ITEM_ONE] },
      NOW
    )
    expect(result).toEqual({
      success: true,
      data: {
        duplicates: [
          {
            studentId: 1,
            studentName: 'Marie Dupont',
            existingStartsAt: '2026-01-15T09:10:00',
            existingActivity: ActivityType.GAME
          }
        ]
      }
    })
  })

  it('lists every duplicate of a multi-student batch and writes nothing', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi
        .fn()
        .mockResolvedValue({ duplicates: [duplicateOf(1, 7), duplicateOf(SECOND_STUDENT_ID, 8)] })
    })
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [ITEM_ONE, ITEM_TWO] },
      NOW
    )
    expect(result.success).toBe(true)
    if (result.success && 'duplicates' in result.data) {
      expect(result.data.duplicates.map((d) => d.studentName)).toEqual([
        'Marie Dupont',
        'Paul Martin'
      ])
    } else {
      throw new Error('expected duplicates')
    }
    expect(gateway.create).not.toHaveBeenCalled()
  })

  it('forwards allowDuplicates: true and writes', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [ITEM_ONE], allowDuplicates: true },
      NOW
    )
    expect(result.success).toBe(true)
    expect(gateway.createManyChecked).toHaveBeenCalledWith([ITEM_ONE], { allowDuplicates: true })
  })

  it('reports an unknown student at its index and still writes the valid items', async () => {
    const gateway = createMockGateway()
    const studentGateway = createMockStudentGateway({
      getByIds: vi.fn().mockResolvedValue([createStudent(1, 'Marie', 'Dupont')])
    })
    const result = await createFrequentationBatch(
      gateway,
      studentGateway,
      {
        frequentations: [
          ITEM_ONE,
          { ...ITEM_TWO, studentId: UNKNOWN_STUDENT_ID },
          { ...ITEM_ONE, startsAt: '2026-01-15T11:00:00' }
        ]
      },
      NOW
    )
    expect(studentGateway.getByIds).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    if (result.success && 'errors' in result.data) {
      expect(result.data.created).toHaveLength(EXPECTED_TWO)
      expect(result.data.errors).toHaveLength(1)
      expect(result.data.errors[0]?.index).toBe(1)
    } else {
      throw new Error('expected a batch result')
    }
    expect(gateway.createManyChecked).toHaveBeenCalledWith(
      [ITEM_ONE, { ...ITEM_ONE, startsAt: '2026-01-15T11:00:00' }],
      { allowDuplicates: false }
    )
  })

  it('returns only the duplicates when an unknown student and a duplicate coexist', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi.fn().mockResolvedValue({ duplicates: [duplicateOf(1, 7)] })
    })
    const studentGateway = createMockStudentGateway({
      getByIds: vi.fn().mockResolvedValue([createStudent(1, 'Marie', 'Dupont')])
    })
    const result = await createFrequentationBatch(
      gateway,
      studentGateway,
      { frequentations: [ITEM_ONE, { ...ITEM_TWO, studentId: UNKNOWN_STUDENT_ID }] },
      NOW
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(['duplicates'])
    }
  })

  it('does not call the gateway write when every student is unknown', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway({ getByIds: vi.fn().mockResolvedValue([]) }),
      { frequentations: [ITEM_ONE] },
      NOW
    )
    expect(result.success).toBe(true)
    if (result.success && 'errors' in result.data) {
      expect(result.data.created).toHaveLength(0)
      expect(result.data.errors).toHaveLength(1)
    }
    expect(gateway.createManyChecked).not.toHaveBeenCalled()
  })

  it('rejects an item with an empty activity as VALIDATION_ERROR and writes nothing', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      // Untrusted IPC payload
      JSON.parse(
        '{"frequentations":[{"startsAt":"2026-01-15T09:00:00","activity":"","studentId":1}]}'
      ),
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    }
    expect(gateway.createManyChecked).not.toHaveBeenCalled()
  })

  it('looks each student up once before writing, then once more to name the warnings', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi.fn().mockResolvedValue({ duplicates: [duplicateOf(1, 7)] })
    })
    const studentGateway = createMockStudentGateway()
    const result = await createFrequentationBatch(
      gateway,
      studentGateway,
      { frequentations: [ITEM_ONE, { ...ITEM_ONE, startsAt: '2026-01-15T09:05:00' }] },
      NOW
    )
    expect(studentGateway.getByIds).toHaveBeenCalledTimes(2)
    expect(studentGateway.getByIds).toHaveBeenNthCalledWith(1, [1])
    expect(studentGateway.getByIds).toHaveBeenNthCalledWith(2, [1])
    expect(result.success).toBe(true)
  })

  it('falls back to the anonymized label for an unnamed duplicate student', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi.fn().mockResolvedValue({ duplicates: [duplicateOf(1, 7)] })
    })
    const studentGateway = createMockStudentGateway({
      getByIds: vi
        .fn()
        .mockResolvedValueOnce([createStudent(1, 'Marie', 'Dupont')])
        .mockResolvedValueOnce([])
    })
    const result = await createFrequentationBatch(
      gateway,
      studentGateway,
      { frequentations: [ITEM_ONE] },
      NOW
    )
    expect(result.success).toBe(true)
    if (result.success && 'duplicates' in result.data) {
      expect(result.data.duplicates[0]?.studentName).toBe(ANONYMIZED_STUDENT_LABEL)
    }
  })

  it('returns DATABASE_ERROR when the gateway throws, with no partial result', async () => {
    const gateway = createMockGateway({
      createManyChecked: vi.fn().mockRejectedValue(new Error('DB conflict'))
    })
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [ITEM_ONE] },
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.DATABASE_ERROR)
      expect(result.error).toContain('DB conflict')
    }
  })

  it('rejects an empty batch', async () => {
    const result = await createFrequentationBatch(
      createMockGateway(),
      createMockStudentGateway(),
      { frequentations: [] },
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('frequentations')
    }
  })

  it('rejects a non-boolean allowDuplicates', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      // Untrusted IPC payload
      JSON.parse(
        '{"frequentations":[{"startsAt":"2026-01-15T09:00:00","activity":"work","studentId":1}],"allowDuplicates":"yes"}'
      ),
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    }
    expect(gateway.createManyChecked).not.toHaveBeenCalled()
  })

  it('rejects the batch with VALIDATION_ERROR when startsAt is not local wall-clock', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      { frequentations: [{ ...ITEM_ONE, startsAt: '2026-01-15T09:00:00Z' }] },
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    }
    expect(gateway.createManyChecked).not.toHaveBeenCalled()
  })

  it('rejects the whole batch when any item is in the future', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(
      gateway,
      createMockStudentGateway(),
      {
        frequentations: [
          { ...ITEM_ONE, startsAt: '2026-11-25T14:00:00' },
          { ...ITEM_ONE, startsAt: '2026-11-26T09:00:00' }
        ]
      },
      NOW
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    }
    expect(gateway.createManyChecked).not.toHaveBeenCalled()
  })

  it('creates a batch dated now', async () => {
    const result = await createFrequentationBatch(
      createMockGateway(),
      createMockStudentGateway(),
      { frequentations: [{ ...ITEM_ONE, startsAt: '2026-11-25T14:30:00' }] },
      NOW
    )
    expect(result.success).toBe(true)
  })
})
