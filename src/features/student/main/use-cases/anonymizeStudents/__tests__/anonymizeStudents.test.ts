import { describe, it, expect, vi } from 'vitest'
import { anonymizeStudents } from '../anonymizeStudents'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'
import { ErrorCode } from '@lib/errors'

const FIRST_ID = 1
const SECOND_ID = 2
const UNKNOWN_ID = 99
const NEGATIVE_ID = -3
const FRACTION_ID = 1.5

function makeStudent(id: number): StudentEntity {
  return {
    id,
    nom: `Nom${id}`,
    prenom: 'Prenom',
    classe: '3B',
    ine: `INE${id}`,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }
}

function createMockGateway(overrides: Partial<StudentGateway> = {}): StudentGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    getByIds: vi
      .fn()
      .mockImplementation(async (ids: number[]) =>
        ids.filter((id) => id !== UNKNOWN_ID).map(makeStudent)
      ),
    getAllWithVisitCount: vi.fn().mockResolvedValue([]),
    countVisitsByStudentId: vi.fn().mockResolvedValue(0),
    anonymizeByIds: vi.fn().mockResolvedValue({ anonymized: 1, deletedWithoutVisits: 1 }),
    withTransaction: vi.fn().mockImplementation((work: () => Promise<unknown>) => work()),
    ...overrides
  }
}

describe('anonymizeStudents', () => {
  it('rejects an empty list (VALIDATION_ERROR, no backup)', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn()
    const result = await anonymizeStudents({ gateway, createAutomaticBackup }, { ids: [] })
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it('rejects non-integer, zero and negative ids', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn()
    for (const bad of [FRACTION_ID, 0, NEGATIVE_ID]) {
      const result = await anonymizeStudents(
        { gateway, createAutomaticBackup },
        { ids: [FIRST_ID, bad] }
      )
      expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    }
    expect(createAutomaticBackup).not.toHaveBeenCalled()
    expect(gateway.anonymizeByIds).not.toHaveBeenCalled()
  })

  it('deduplicates ids before calling the gateway', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn().mockResolvedValue('/b.db')
    await anonymizeStudents(
      { gateway, createAutomaticBackup },
      { ids: [FIRST_ID, SECOND_ID, FIRST_ID] }
    )
    expect(gateway.getByIds).toHaveBeenCalledWith([FIRST_ID, SECOND_ID])
    expect(gateway.anonymizeByIds).toHaveBeenCalledWith([FIRST_ID, SECOND_ID])
  })

  it('unknown ids only: success with zeros, ignored = n, no backup', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn()
    const result = await anonymizeStudents(
      { gateway, createAutomaticBackup },
      { ids: [UNKNOWN_ID] }
    )
    expect(result).toEqual({
      success: true,
      data: { anonymized: 0, deletedWithoutVisits: 0, ignored: 1 }
    })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
    expect(gateway.anonymizeByIds).not.toHaveBeenCalled()
  })

  it('mix of known and unknown: ignored counted, gateway gets known ids only', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn().mockResolvedValue('/b.db')
    const result = await anonymizeStudents(
      { gateway, createAutomaticBackup },
      { ids: [FIRST_ID, UNKNOWN_ID] }
    )
    expect(gateway.anonymizeByIds).toHaveBeenCalledWith([FIRST_ID])
    expect(result).toMatchObject({ success: true, data: { ignored: 1 } })
  })

  it("takes the backup with 'anonymization' BEFORE the gateway call", async () => {
    const order: string[] = []
    const gateway = createMockGateway({
      anonymizeByIds: vi.fn().mockImplementation(async () => {
        order.push('gateway')
        return { anonymized: 1, deletedWithoutVisits: 0 }
      })
    })
    const createAutomaticBackup = vi.fn().mockImplementation(async () => {
      order.push('backup')
      return '/b.db'
    })
    await anonymizeStudents({ gateway, createAutomaticBackup }, { ids: [FIRST_ID] })
    expect(createAutomaticBackup).toHaveBeenCalledWith('anonymization')
    expect(order).toEqual(['backup', 'gateway'])
  })

  it('backup failure returns BACKUP_WRITE_FAILED and never calls the gateway', async () => {
    const gateway = createMockGateway()
    const createAutomaticBackup = vi.fn().mockRejectedValue(new Error('disk full'))
    const result = await anonymizeStudents({ gateway, createAutomaticBackup }, { ids: [FIRST_ID] })
    expect(result).toMatchObject({ success: false, code: ErrorCode.BACKUP_WRITE_FAILED })
    expect(gateway.anonymizeByIds).not.toHaveBeenCalled()
  })

  it('gateway failure returns DATABASE_ERROR', async () => {
    const gateway = createMockGateway({
      anonymizeByIds: vi.fn().mockRejectedValue(new Error('boom'))
    })
    const createAutomaticBackup = vi.fn().mockResolvedValue('/b.db')
    const result = await anonymizeStudents({ gateway, createAutomaticBackup }, { ids: [FIRST_ID] })
    expect(result).toMatchObject({ success: false, code: ErrorCode.DATABASE_ERROR })
  })

  it('returns anonymized and deletedWithoutVisits from the gateway', async () => {
    const gateway = createMockGateway({
      anonymizeByIds: vi.fn().mockResolvedValue({ anonymized: 3, deletedWithoutVisits: 2 })
    })
    const createAutomaticBackup = vi.fn().mockResolvedValue('/b.db')
    const result = await anonymizeStudents(
      { gateway, createAutomaticBackup },
      { ids: [FIRST_ID, SECOND_ID] }
    )
    expect(result).toEqual({
      success: true,
      data: { anonymized: 3, deletedWithoutVisits: 2, ignored: 0 }
    })
  })
})
