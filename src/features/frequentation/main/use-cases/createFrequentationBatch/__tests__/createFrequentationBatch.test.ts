import { describe, it, expect, vi } from 'vitest'
import { ActivityType } from '@types'
import { createFrequentationBatch } from '../createFrequentationBatch'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { FrequentationEntity } from '@frequentation/entities/frequentation'
import { ErrorCode } from '@lib/errors'

const SECOND_STUDENT_ID = 2
const EXPECTED_TWO = 2

const TEST_YEAR = 2026
const TEST_MONTH_INDEX = 10
const TEST_DAY = 25
const NOW_HOUR = 14
const NOW_MINUTE = 30

const VALID_ENTITY: FrequentationEntity = {
  id: 1,
  startsAt: '2026-01-15T09:00:00',
  activity: ActivityType.WORK,
  studentId: 1,
  createdAt: '2026-01-15T09:00:00',
  updatedAt: '2026-01-15T09:00:00'
}

function createMockGateway(overrides: Partial<FrequentationGateway> = {}): FrequentationGateway {
  return {
    create: vi.fn().mockResolvedValue(VALID_ENTITY),
    getById: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    getByStudentId: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    deleteByStudentId: vi.fn().mockResolvedValue(0),
    count: vi.fn().mockResolvedValue(0),
    ...overrides
  }
}

describe('createFrequentationBatch', () => {
  it('creates all frequentations in a valid batch', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(gateway, {
      frequentations: [
        { startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: 1 },
        {
          startsAt: '2026-01-15T10:00:00',
          activity: ActivityType.READING,
          studentId: SECOND_STUDENT_ID
        }
      ]
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.created).toHaveLength(EXPECTED_TWO)
      expect(result.data.errors).toHaveLength(0)
    }
  })

  it('rejects an empty batch', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(gateway, {
      frequentations: []
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('frequentations')
    }
  })

  it('rejects the batch with VALIDATION_ERROR when startsAt is not local wall-clock', async () => {
    const gateway = createMockGateway()
    const result = await createFrequentationBatch(gateway, {
      frequentations: [
        { startsAt: '2026-01-15T09:00:00Z', activity: ActivityType.WORK, studentId: 1 }
      ]
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    }
    expect(gateway.create).not.toHaveBeenCalled()
  })

  it('collects errors from gateway failures while creating valid items', async () => {
    let callCount = 0
    const gateway = createMockGateway({
      create: vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) {
          return Promise.resolve(VALID_ENTITY)
        }
        return Promise.reject(new Error('DB conflict'))
      })
    })
    const result = await createFrequentationBatch(gateway, {
      frequentations: [
        { startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: 1 },
        {
          startsAt: '2026-01-15T10:00:00',
          activity: ActivityType.WORK,
          studentId: SECOND_STUDENT_ID
        }
      ]
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.created).toHaveLength(1)
      expect(result.data.errors).toHaveLength(1)
      expect(result.data.errors[0]?.error).toContain('DB conflict')
    }
  })

  describe('future dates', () => {
    const NOW = new Date(TEST_YEAR, TEST_MONTH_INDEX, TEST_DAY, NOW_HOUR, NOW_MINUTE)

    it('rejects the whole batch when any item is in the future', async () => {
      const gateway = createMockGateway()
      const result = await createFrequentationBatch(
        gateway,
        {
          frequentations: [
            { startsAt: '2026-11-25T14:00:00', activity: ActivityType.WORK, studentId: 1 },
            { startsAt: '2026-11-26T09:00:00', activity: ActivityType.WORK, studentId: 1 }
          ]
        },
        NOW
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
      }
      expect(gateway.create).not.toHaveBeenCalled()
    })

    it('creates a batch dated now', async () => {
      const result = await createFrequentationBatch(
        createMockGateway(),
        {
          frequentations: [
            { startsAt: '2026-11-25T14:30:00', activity: ActivityType.WORK, studentId: 1 }
          ]
        },
        NOW
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.created).toHaveLength(1)
      }
    })
  })
})
