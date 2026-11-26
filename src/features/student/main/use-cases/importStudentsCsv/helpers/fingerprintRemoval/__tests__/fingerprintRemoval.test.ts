import { describe, it, expect } from 'vitest'
import type { StudentEntity } from '@student/entities/student'
import { fingerprintRemoval } from '../fingerprintRemoval'

function student(id: number, ine: string): StudentEntity {
  return {
    id,
    nom: 'N',
    prenom: 'P',
    classe: '3B',
    ine,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('fingerprintRemoval', () => {
  it('does not depend on the order or the case of the INEs', () => {
    expect(fingerprintRemoval([student(1, 'a1'), student(2, 'B2')])).toBe(
      fingerprintRemoval([student(2, 'b2'), student(1, 'A1')])
    )
  })

  it('differs when the removed set differs', () => {
    expect(fingerprintRemoval([student(1, 'A1')])).not.toBe(fingerprintRemoval([student(2, 'B2')]))
  })

  it('is a stable value for an empty removal', () => {
    expect(fingerprintRemoval([])).toBe(fingerprintRemoval([]))
  })
})
