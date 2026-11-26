import { describe, it, expect, vi } from 'vitest'
import { previewCsvRemoval } from '../previewCsvRemoval'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'

const HEADER = 'nom;prenom;classe;ine'
const SAMPLE_LIMIT = 20
const MANY = 25
const KEEP_ID = 999

function student(id: number, nom: string, prenom: string, ine: string): StudentEntity {
  return {
    id,
    nom,
    prenom,
    classe: '3B',
    ine,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function gatewayWith(students: StudentEntity[]): StudentGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn().mockResolvedValue(students),
    update: vi.fn(),
    delete: vi.fn(),
    getByIds: vi.fn(),
    getAllWithVisitCount: vi.fn(),
    countVisitsByStudentId: vi.fn(),
    anonymizeByIds: vi.fn(),
    withTransaction: vi.fn()
  }
}

describe('previewCsvRemoval', () => {
  it('sample is capped at 20 and sorted', async () => {
    const students = Array.from({ length: MANY }, (_, index) =>
      student(index + 1, `Nom${String(MANY - index).padStart(2, '0')}`, 'Zoe', `INE${index}`)
    )
    const result = await previewCsvRemoval(
      { gateway: gatewayWith([...students, student(KEEP_ID, 'Keep', 'Me', 'KEEP')]) },
      { csv: `${HEADER}\nKeep;Me;3B;KEEP` }
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.toRemove).toBe(MANY)
      expect(result.data.sample).toHaveLength(SAMPLE_LIMIT)
      expect(result.data.sample[0]).toBe('Zoe Nom01')
      expect(result.data.sample[SAMPLE_LIMIT - 1]).toBe('Zoe Nom20')
    }
  })

  it('blocked reason returns toRemove 0', async () => {
    const result = await previewCsvRemoval(
      { gateway: gatewayWith([student(1, 'A', 'B', 'X')]) },
      { csv: `${HEADER}\n;;;` }
    )
    expect(result).toEqual({
      success: true,
      data: { toRemove: 0, total: 1, sample: [], blockedReason: 'rowErrors' }
    })
  })

  it('total counts existing students', async () => {
    const result = await previewCsvRemoval(
      { gateway: gatewayWith([student(1, 'A', 'B', 'X'), student(2, 'C', 'D', 'Y')]) },
      { csv: `${HEADER}\nA;B;3B;X` }
    )
    expect(result.success && result.data.total).toBe(2)
    expect(result.success && result.data.toRemove).toBe(1)
  })

  it('0 to remove', async () => {
    const result = await previewCsvRemoval(
      { gateway: gatewayWith([student(1, 'A', 'B', 'X')]) },
      { csv: `${HEADER}\nA;B;3B;x` }
    )
    expect(result).toEqual({ success: true, data: { toRemove: 0, total: 1, sample: [] } })
  })
})
