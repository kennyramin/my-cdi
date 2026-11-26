import { describe, it, expect, vi } from 'vitest'
import { ActivityType } from '@types'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'
import type { DuplicateMatch } from '@frequentation/gateways/frequentation'
import { buildDuplicateWarnings } from '../buildDuplicateWarnings'

const STUDENT_ID = 1
const MISSING_STUDENT_ID = 9
const EXISTING_ID = 7
const OTHER_EXISTING_ID = 8

const STUDENT: StudentEntity = {
  id: STUDENT_ID,
  prenom: 'Marie',
  nom: 'Dupont',
  classe: '6A',
  ine: 'INE1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

function match(studentId: number, existingId: number): DuplicateMatch {
  return {
    studentId,
    existingId,
    existingStartsAt: '2026-01-15T09:10:00',
    existingActivity: ActivityType.GAME
  }
}

function createStudentGateway(students: StudentEntity[]): StudentGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByIds: vi.fn().mockResolvedValue(students),
    getAllWithVisitCount: vi.fn(),
    countVisitsByStudentId: vi.fn(),
    anonymizeByIds: vi.fn(),
    checkpoint: vi.fn(),
    withTransaction: vi.fn()
  }
}

describe('buildDuplicateWarnings', () => {
  it('names each match and drops repeated existing visits', async () => {
    const gateway = createStudentGateway([STUDENT])
    const warnings = await buildDuplicateWarnings(gateway, [
      match(STUDENT_ID, EXISTING_ID),
      match(STUDENT_ID, EXISTING_ID),
      match(STUDENT_ID, OTHER_EXISTING_ID)
    ])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toEqual({
      studentId: STUDENT_ID,
      studentName: 'Marie Dupont',
      existingStartsAt: '2026-01-15T09:10:00',
      existingActivity: ActivityType.GAME
    })
    expect(gateway.getByIds).toHaveBeenCalledWith([STUDENT_ID])
  })

  it('falls back to the anonymized label when the student is gone', async () => {
    const warnings = await buildDuplicateWarnings(createStudentGateway([]), [
      match(MISSING_STUDENT_ID, EXISTING_ID)
    ])
    expect(warnings[0]?.studentName).toBe(ANONYMIZED_STUDENT_LABEL)
  })
})
