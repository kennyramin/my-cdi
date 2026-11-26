import { describe, it, expect } from 'vitest'
import { planCsvRemoval } from '../planCsvRemoval'
import { parseStudentCsv } from '../../parseStudentCsv'
import type { StudentEntity } from '@student/entities/student'

const HEADER = 'nom;prenom;classe;ine'

function student(id: number, ine: string): StudentEntity {
  return {
    id,
    nom: `Nom${id}`,
    prenom: `Prenom${id}`,
    classe: '3B',
    ine,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('planCsvRemoval', () => {
  it('normalises INE on both sides', () => {
    const existing = [student(1, ' ab12 '), student(2, 'cd34')]
    const parsed = parseStudentCsv(`${HEADER}\nA;B;3B;AB12\nC;D;3B; CD34`)
    expect(planCsvRemoval(existing, parsed)).toEqual({ toRemove: [] })
  })

  it('row errors block (even with valid rows)', () => {
    const parsed = parseStudentCsv(`${HEADER}\nA;B;3B;AB12\n;X;3B;ZZ`)
    const plan = planCsvRemoval([student(1, 'OTHER')], parsed)
    expect(plan.blockedReason).toBe('rowErrors')
    expect(plan.toRemove).toEqual([])
  })

  it('a header mismatch (wrong file) is blocked as missingColumns, not rowErrors', () => {
    const plan = planCsvRemoval([student(1, 'X')], parseStudentCsv('nom;prenom\nA;B'))
    expect(plan.blockedReason).toBe('missingColumns')
    expect(plan.toRemove).toEqual([])
  })

  it('empty file blocks (header only)', () => {
    const plan = planCsvRemoval([student(1, 'X')], parseStudentCsv(HEADER))
    expect(plan.blockedReason).toBe('emptyFile')
    expect(plan.toRemove).toEqual([])
  })

  it('empty file blocks (only invalid rows -> rowErrors)', () => {
    const plan = planCsvRemoval([student(1, 'X')], parseStudentCsv(`${HEADER}\n;;;`))
    expect(plan.blockedReason).toBe('rowErrors')
  })

  it('quote error blocks removal', () => {
    const parsed = parseStudentCsv(`${HEADER}\nA;B;3B;AB12\n"Unterminated;B;3B;ZZ9`)
    expect(parsed.errors.some((e) => e.type === 'ROW_VALIDATION')).toBe(true)
    const plan = planCsvRemoval([student(1, 'OTHER')], parsed)
    expect(plan.blockedReason).toBe('rowErrors')
  })

  it('students present in the file are never listed', () => {
    const existing = [student(1, 'KEEP'), student(2, 'GONE')]
    const plan = planCsvRemoval(existing, parseStudentCsv(`${HEADER}\nA;B;3B;KEEP`))
    expect(plan.toRemove.map((s) => s.id)).toEqual([2])
  })

  it('duplicate INE inside the file does not block', () => {
    const existing = [student(1, 'DUP'), student(2, 'GONE')]
    const plan = planCsvRemoval(existing, parseStudentCsv(`${HEADER}\nA;B;3B;DUP\nC;D;3B;DUP`))
    expect(plan.blockedReason).toBeUndefined()
    expect(plan.toRemove.map((s) => s.id)).toEqual([2])
  })
})
