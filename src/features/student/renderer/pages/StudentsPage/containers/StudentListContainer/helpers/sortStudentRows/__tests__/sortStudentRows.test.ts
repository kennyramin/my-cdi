import { describe, it, expect } from 'vitest'
import { sortStudentRows } from '../sortStudentRows'
import type { StudentViewModel, StudentSortConfig } from '@student/types'

const ID_FIRST = 1
const ID_SECOND = 2
const ID_THIRD = 3
const INDEX_LAST = 2
const VISIT_COUNTS = [10, 9, 0]

const STUDENTS: StudentViewModel[] = [
  {
    id: ID_FIRST,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: '111A',
    fullName: 'Jean Dupont',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0,
    displayName: 'Jean Dupont',
    classLabel: '3ème A'
  },
  {
    id: ID_SECOND,
    nom: 'Martin',
    prenom: 'Marie',
    classe: '3ème B',
    ine: '222B',
    fullName: 'Marie Martin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0,
    displayName: 'Marie Martin',
    classLabel: '3ème B'
  },
  {
    id: ID_THIRD,
    nom: 'Bernard',
    prenom: 'Luc',
    classe: '4ème C',
    ine: '333C',
    fullName: 'Luc Bernard',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0,
    displayName: 'Luc Bernard',
    classLabel: '4ème C'
  }
]

describe('sortStudentRows', () => {
  it('sorts by nom ascending', () => {
    const config: StudentSortConfig = { field: 'nom', direction: 'asc' }
    const result = sortStudentRows([...STUDENTS], config)
    expect(result[0]?.nom).toBe('Bernard')
    expect(result[INDEX_LAST]?.nom).toBe('Martin')
  })

  it('sorts by nom descending', () => {
    const config: StudentSortConfig = { field: 'nom', direction: 'desc' }
    const result = sortStudentRows([...STUDENTS], config)
    expect(result[0]?.nom).toBe('Martin')
    expect(result[INDEX_LAST]?.nom).toBe('Bernard')
  })

  it('sorts by prenom ascending', () => {
    const config: StudentSortConfig = { field: 'prenom', direction: 'asc' }
    const result = sortStudentRows([...STUDENTS], config)
    expect(result[0]?.prenom).toBe('Jean')
    expect(result[INDEX_LAST]?.prenom).toBe('Marie')
  })

  it('sorts by classe ascending', () => {
    const config: StudentSortConfig = { field: 'classe', direction: 'asc' }
    const result = sortStudentRows([...STUDENTS], config)
    expect(result[0]?.classe).toBe('3ème A')
  })

  it('sorts by ine ascending', () => {
    const config: StudentSortConfig = { field: 'ine', direction: 'asc' }
    const result = sortStudentRows([...STUDENTS], config)
    expect(result[0]?.ine).toBe('111A')
  })

  it('sorts visitCount numerically', () => {
    const rows = STUDENTS.map((student, index) => ({
      ...student,
      visitCount: VISIT_COUNTS[index] ?? 0
    }))
    const asc = sortStudentRows(rows, { field: 'visitCount', direction: 'asc' })
    const desc = sortStudentRows(rows, { field: 'visitCount', direction: 'desc' })
    expect(asc.map((row) => row.visitCount)).toEqual([...VISIT_COUNTS].reverse())
    expect(desc.map((row) => row.visitCount)).toEqual(VISIT_COUNTS)
  })

  it('breaks visitCount ties by nom then prenom', () => {
    const names = [
      { nom: 'Martin', prenom: 'Zoé' },
      { nom: 'Martin', prenom: 'Alice' },
      { nom: 'Bernard', prenom: 'Luc' }
    ]
    const tied = STUDENTS.map((student, index) => ({
      ...student,
      ...names[index],
      visitCount: 4
    }))
    const desc = sortStudentRows(tied, { field: 'visitCount', direction: 'desc' })
    expect(desc.map((row) => row.id)).toEqual([ID_THIRD, ID_SECOND, ID_FIRST])
    const asc = sortStudentRows(tied, { field: 'visitCount', direction: 'asc' })
    expect(asc.map((row) => row.id)).toEqual([ID_THIRD, ID_SECOND, ID_FIRST])
  })

  it('does not mutate the original array', () => {
    const original = [...STUDENTS]
    const config: StudentSortConfig = { field: 'nom', direction: 'asc' }
    sortStudentRows(original, config)
    expect(original[0]?.nom).toBe('Dupont')
  })

  it('returns same order for equal values', () => {
    const same: StudentViewModel[] = [
      {
        id: ID_FIRST,
        nom: 'A',
        prenom: 'A',
        classe: 'A',
        ine: '1',
        fullName: 'A A',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visitCount: 0,
        displayName: 'A A',
        classLabel: 'A'
      },
      {
        id: ID_SECOND,
        nom: 'A',
        prenom: 'B',
        classe: 'A',
        ine: '2',
        fullName: 'B A',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visitCount: 0,
        displayName: 'B A',
        classLabel: 'A'
      }
    ]
    const config: StudentSortConfig = { field: 'nom', direction: 'asc' }
    const result = sortStudentRows(same, config)
    expect(result[0]?.id).toBe(ID_FIRST)
    expect(result[1]?.id).toBe(ID_SECOND)
  })
})
