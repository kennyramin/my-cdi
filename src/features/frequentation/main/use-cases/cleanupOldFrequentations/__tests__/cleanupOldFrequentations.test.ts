import { describe, it, expect, vi } from 'vitest'
import {
  cleanupOldFrequentations,
  buildRetentionCutoff,
  CLEANUP_RETENTION_YEARS
} from '../cleanupOldFrequentations'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'

const NOW_YEAR = 2026
const NOW_MONTH_INDEX = 10
const NOW_DAY = 25
const NOW_MINUTES = 30
const DELETED_COUNT = 3

function createMockGateway(overrides: Partial<FrequentationGateway> = {}): FrequentationGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getByStudentId: vi.fn(),
    getByDateRange: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    deleteByStudentId: vi.fn(),
    deleteOlderThan: vi.fn().mockResolvedValue(0),
    count: vi.fn().mockResolvedValue(0),
    ...overrides
  }
}

function buildNow(): Date {
  return new Date(NOW_YEAR, NOW_MONTH_INDEX, NOW_DAY, 0, NOW_MINUTES, 0)
}

describe('cleanupOldFrequentations', () => {
  it('builds a local cutoff two years back', () => {
    expect(buildRetentionCutoff(buildNow())).toBe('2024-11-25T00:30:00')
  })

  it('deletes with a single gateway call', async () => {
    const gateway = createMockGateway({
      deleteOlderThan: vi.fn().mockResolvedValue(DELETED_COUNT)
    })
    const result = await cleanupOldFrequentations(gateway, buildNow())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deletedCount).toBe(DELETED_COUNT)
    }
    expect(gateway.deleteOlderThan).toHaveBeenCalledTimes(1)
    expect(gateway.deleteOlderThan).toHaveBeenCalledWith('2024-11-25T00:30:00')
    expect(gateway.getAll).not.toHaveBeenCalled()
    expect(gateway.delete).not.toHaveBeenCalled()
  })

  it('returns error when gateway throws', async () => {
    const gateway = createMockGateway({
      deleteOlderThan: vi.fn().mockRejectedValue(new Error('DB error'))
    })
    const result = await cleanupOldFrequentations(gateway)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('DB error')
    }
  })

  it('exposes CLEANUP_RETENTION_YEARS constant equal to expected value', () => {
    const EXPECTED_RETENTION_YEARS = 2
    expect(CLEANUP_RETENTION_YEARS).toBe(EXPECTED_RETENTION_YEARS)
  })
})
