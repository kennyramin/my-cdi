import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import type { StudentWithVisitCountEntity } from '@student/entities/student'
import type { StatsForPeriodDto } from '@statistics-shared'
import { ActivityType } from '@types'
import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_HEADER,
  CLASS_HEADER,
  DAY_HEADER,
  STUDENTS_HEADER,
  buildActivityRows,
  buildClassRows,
  buildDayRows,
  buildJournalRow,
  buildStudentRow,
  journalHeader
} from '..'

const BIG_COUNT = 12345
const HALF_RATE = 50

const entry = (
  overrides: Partial<FrequentationWithStudentEntity> = {}
): FrequentationWithStudentEntity => ({
  id: 1,
  startsAt: '2026-03-05T09:07:00',
  activity: ActivityType.READING,
  studentId: 7,
  studentClasse: '6A',
  createdAt: '2026-03-05T09:07:00',
  updatedAt: '2026-03-05T09:07:00',
  studentNom: 'Dupont',
  studentPrenom: 'Léa',
  studentIne: '123456789AB',
  ...overrides
})

const stats: StatsForPeriodDto = {
  totalVisits: BIG_COUNT,
  averagePerDay: 1,
  morningRate: HALF_RATE,
  afternoonRate: HALF_RATE,
  dailyCounts: [{ date: '2026-03-05', count: BIG_COUNT }],
  activityCounts: [{ activity: ActivityType.GAME, count: 3 }],
  classCounts: [{ classe: '3-B', count: 2 }]
}

describe('exportRows', () => {
  it('journal row without names has exactly date, heure, classe, activité', () => {
    expect(buildJournalRow(entry(), false)).toEqual(['2026-03-05', '09:07', '6A', 'Lecture'])
  })

  it('journal row with names appends nom, prénom, INE', () => {
    expect(journalHeader(true).join(';')).toBe('date;heure;classe;activité;nom;prénom;INE')
    expect(buildJournalRow(entry(), true)).toEqual([
      '2026-03-05',
      '09:07',
      '6A',
      'Lecture',
      'Dupont',
      'Léa',
      '123456789AB'
    ])
  })

  it('keeps the local time of a late-evening visit on its own day', () => {
    expect(buildJournalRow(entry({ startsAt: '2026-03-05T23:59:00' }), false)).toEqual([
      '2026-03-05',
      '23:59',
      '6A',
      'Lecture'
    ])
  })

  it('a linked student with null name and INE yields empty cells, not the anonymized label', () => {
    expect(
      buildJournalRow(entry({ studentNom: null, studentPrenom: null, studentIne: null }), true)
    ).toEqual(['2026-03-05', '09:07', '6A', 'Lecture', '', '', ''])
  })

  it('uses the snapshot class carried by the entry', () => {
    expect(buildJournalRow(entry({ studentClasse: '5B' }), false)[2]).toBe('5B')
  })

  it('anonymized entry shows the label, empty prénom and empty INE', () => {
    expect(
      buildJournalRow(
        entry({ studentId: null, studentNom: null, studentPrenom: null, studentIne: null }),
        true
      )
    ).toEqual(['2026-03-05', '09:07', '6A', 'Lecture', 'Élève anonymisé', '', ''])
  })

  it('never exposes a previous name on an anonymized entry', () => {
    const row = buildJournalRow(entry({ studentId: null }), true)
    expect(row).not.toContain('Dupont')
    expect(row).not.toContain('Léa')
    expect(row).not.toContain('123456789AB')
  })

  it('journal header and rows without names contain no name/INE column even if the entry has them', () => {
    expect(journalHeader(false)).toEqual(['date', 'heure', 'classe', 'activité'])
    expect(buildJournalRow(entry(), false)).toHaveLength(4)
  })

  it('aggregated statistics carry no personal field at the type level', () => {
    // @ts-expect-error StatsForPeriodDto has no student name
    expect(stats.nom).toBeUndefined()
    // @ts-expect-error StatsForPeriodDto has no first name
    expect(stats.prenom).toBeUndefined()
    // @ts-expect-error StatsForPeriodDto has no INE
    expect(stats.ine).toBeUndefined()
    // @ts-expect-error StatsForPeriodDto has no student list
    expect(stats.students).toBeUndefined()
  })

  it('aggregated rows contain no name or INE', () => {
    const forbidden = new Set(['Dupont', 'Léa', '123456789AB'])
    const rows = [...buildDayRows(stats), ...buildActivityRows(stats), ...buildClassRows(stats)]
    expect(rows.flat().some((cell) => forbidden.has(cell))).toBe(false)
  })

  it('activity rows use French labels', () => {
    expect(buildActivityRows(stats)).toEqual([['Jeu de société', '3']])
    expect(ACTIVITY_HEADER).toEqual(['activité', 'visites'])
  })

  it('day rows keep AAAA-MM-JJ and counts as plain digits', () => {
    expect(buildDayRows(stats)).toEqual([['2026-03-05', '12345']])
    expect(DAY_HEADER).toEqual(['date', 'visites'])
  })

  it('class rows list class and count', () => {
    expect(buildClassRows(stats)).toEqual([['3-B', '2']])
    expect(CLASS_HEADER).toEqual(['classe', 'visites'])
  })

  it('students row', () => {
    const student: StudentWithVisitCountEntity = {
      id: 1,
      nom: 'Dupont',
      prenom: 'Léa',
      classe: '3-B',
      ine: '123456789AB',
      createdAt: '',
      updatedAt: '',
      visitCount: 4
    }
    expect(buildStudentRow(student)).toEqual(['Dupont', 'Léa', '3-B', '123456789AB', '4'])
    expect(STUDENTS_HEADER).toEqual(['nom', 'prénom', 'classe', 'INE', 'visites'])
  })

  it('empty stats produce no rows', () => {
    const empty = { ...stats, dailyCounts: [], activityCounts: [], classCounts: [] }
    expect(buildDayRows(empty)).toEqual([])
    expect(buildActivityRows(empty)).toEqual([])
    expect(buildClassRows(empty)).toEqual([])
  })
})
