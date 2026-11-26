import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { StudentWithVisitCountEntity } from '@student/entities/student'
import type { StatsForPeriodDto } from '@statistics-shared'

import { ACTIVITY_EXPORT_LABELS } from './exportLabels'

export type CsvRow = readonly string[]

const DATE_START = 0
const DATE_END = 10
const TIME_START = 11
const TIME_END = 16
const EMPTY_CELL = ''

const JOURNAL_BASE_HEADER: CsvRow = ['date', 'heure', 'classe', 'activité']
const JOURNAL_NAMES_HEADER: CsvRow = ['nom', 'prénom', 'INE']

export const DAY_HEADER: CsvRow = ['date', 'visites']
export const ACTIVITY_HEADER: CsvRow = ['activité', 'visites']
export const CLASS_HEADER: CsvRow = ['classe', 'visites']
export const STUDENTS_HEADER: CsvRow = ['nom', 'prénom', 'classe', 'INE', 'visites']

export const journalHeader = (includeNames: boolean): CsvRow =>
  includeNames ? [...JOURNAL_BASE_HEADER, ...JOURNAL_NAMES_HEADER] : JOURNAL_BASE_HEADER

export const buildJournalRow = (
  entry: FrequentationWithStudentEntity,
  includeNames: boolean
): CsvRow => {
  const base = [
    entry.startsAt.slice(DATE_START, DATE_END),
    entry.startsAt.slice(TIME_START, TIME_END),
    entry.studentClasse,
    ACTIVITY_EXPORT_LABELS[entry.activity]
  ]
  if (!includeNames) {
    return base
  }
  if (entry.studentId === null) {
    return [...base, ANONYMIZED_STUDENT_LABEL, EMPTY_CELL, EMPTY_CELL]
  }
  return [
    ...base,
    entry.studentNom ?? EMPTY_CELL,
    entry.studentPrenom ?? EMPTY_CELL,
    entry.studentIne ?? EMPTY_CELL
  ]
}

export const buildDayRows = (stats: StatsForPeriodDto): CsvRow[] =>
  stats.dailyCounts.map((day) => [day.date, String(day.count)])

export const buildActivityRows = (stats: StatsForPeriodDto): CsvRow[] =>
  stats.activityCounts.map((item) => [ACTIVITY_EXPORT_LABELS[item.activity], String(item.count)])

export const buildClassRows = (stats: StatsForPeriodDto): CsvRow[] =>
  stats.classCounts.map((item) => [item.classe, String(item.count)])

export const buildStudentRow = (student: StudentWithVisitCountEntity): CsvRow => [
  student.nom,
  student.prenom,
  student.classe,
  student.ine,
  String(student.visitCount)
]
