import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrateTestDatabase } from '../testing/migrateTestDatabase'

const MIGRATIONS_BEFORE_0004 = 4
const ORPHAN_STUDENT_ID = 99
const NEXT_ID_AFTER_THREE_VISITS = 4
const FIRST_ID = 1
const THREE_VISITS = 3
const STARTS_AT = '2026-01-12T09:00:00'
const CREATED_AT = '2026-01-12T09:00:01.000Z'
const UPDATED_AT = '2026-01-12T09:00:02.000Z'

interface Row {
  [column: string]: unknown
}

let sqlite: Database.Database

function insertStudent(id: number, classe: string): void {
  sqlite
    .prepare(
      'INSERT INTO students (id, nom, prenom, classe, ine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, `Nom${id}`, `Prenom${id}`, classe, `INE${id}`, CREATED_AT, UPDATED_AT)
}

function insertVisit(id: number, studentId: number, activity = 'work'): void {
  sqlite
    .prepare(
      'INSERT INTO frequentation (id, starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, STARTS_AT, activity, studentId, CREATED_AT, UPDATED_AT)
}

function rows(sql: string): Row[] {
  return sqlite.prepare<[], Row>(sql).all()
}

function seedStudentsAndVisits(): void {
  insertStudent(1, '6A')
  insertStudent(2, '5B')
  insertVisit(1, 1, 'reading')
  insertVisit(2, 2, 'game')
  insertVisit(3, 1, 'computer')
}

describe('migration 0004 (nullable student_id and class snapshot)', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    migrateTestDatabase(sqlite, { upTo: MIGRATIONS_BEFORE_0004 })
  })

  afterEach(() => {
    sqlite.close()
  })

  it('backfills student_classe from students.classe', () => {
    seedStudentsAndVisits()
    migrateTestDatabase(sqlite)
    expect(rows('SELECT id, student_classe FROM frequentation ORDER BY id')).toEqual([
      { id: 1, student_classe: '6A' },
      { id: 2, student_classe: '5B' },
      { id: 3, student_classe: '6A' }
    ])
  })

  it('preserves every visit row, id and timestamps', () => {
    seedStudentsAndVisits()
    const before = rows(
      'SELECT id, starts_at, activity, student_id, created_at, updated_at FROM frequentation ORDER BY id'
    )
    migrateTestDatabase(sqlite)
    const after = rows(
      'SELECT id, starts_at, activity, student_id, created_at, updated_at FROM frequentation ORDER BY id'
    )
    expect(after).toEqual(before)
    expect(after).toHaveLength(THREE_VISITS)
  })

  it('does not delete or alter students', () => {
    seedStudentsAndVisits()
    const before = rows('SELECT * FROM students ORDER BY id')
    migrateTestDatabase(sqlite)
    expect(rows('SELECT * FROM students ORDER BY id')).toEqual(before)
  })

  it('foreign_key_check reports no violation', () => {
    seedStudentsAndVisits()
    migrateTestDatabase(sqlite)
    expect(rows('PRAGMA foreign_key_check')).toEqual([])
  })

  it('student_id accepts NULL after migration', () => {
    migrateTestDatabase(sqlite)
    expect(() =>
      sqlite
        .prepare(
          'INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at, student_classe) VALUES (?, ?, NULL, ?, ?, ?)'
        )
        .run(STARTS_AT, 'work', CREATED_AT, UPDATED_AT, '6A')
    ).not.toThrow()
  })

  it('deleting a student still cascades its visits', () => {
    seedStudentsAndVisits()
    migrateTestDatabase(sqlite)
    sqlite.prepare('DELETE FROM students WHERE id = 1').run()
    expect(rows('SELECT id FROM frequentation ORDER BY id')).toEqual([{ id: 2 }])
  })

  it('a NULL student_id row survives deleting every student', () => {
    seedStudentsAndVisits()
    migrateTestDatabase(sqlite)
    sqlite
      .prepare(
        'INSERT INTO frequentation (id, starts_at, activity, student_id, created_at, updated_at, student_classe) VALUES (10, ?, ?, NULL, ?, ?, ?)'
      )
      .run(STARTS_AT, 'work', CREATED_AT, UPDATED_AT, '3C')
    sqlite.prepare('DELETE FROM students').run()
    expect(rows('SELECT id FROM frequentation')).toEqual([{ id: 10 }])
  })

  it('keeps the unique AUTOINCREMENT sequence', () => {
    seedStudentsAndVisits()
    sqlite.prepare('DELETE FROM frequentation WHERE id = 3').run()
    migrateTestDatabase(sqlite)
    sqlite
      .prepare(
        'INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(STARTS_AT, 'work', CREATED_AT, UPDATED_AT)
    expect(rows('SELECT MAX(id) AS id FROM frequentation')).toEqual([
      { id: NEXT_ID_AFTER_THREE_VISITS }
    ])
  })

  it('recreates both indexes', () => {
    migrateTestDatabase(sqlite)
    const names = rows(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'frequentation'"
    ).map((row) => row.name)
    expect(names).toContain('idx_freq_student')
    expect(names).toContain('idx_freq_starts_at')
  })

  it('empty table migrates', () => {
    migrateTestDatabase(sqlite)
    insertStudent(1, '6A')
    sqlite
      .prepare(
        'INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(STARTS_AT, 'work', CREATED_AT, UPDATED_AT)
    expect(rows('SELECT id FROM frequentation')).toEqual([{ id: FIRST_ID }])
  })

  it('legacy orphan visit gets a NULL snapshot', () => {
    sqlite.pragma('foreign_keys = OFF')
    insertVisit(1, ORPHAN_STUDENT_ID)
    sqlite.pragma('foreign_keys = ON')
    migrateTestDatabase(sqlite)
    expect(rows('SELECT id, student_id, student_classe FROM frequentation')).toEqual([
      { id: 1, student_id: null, student_classe: null }
    ])
  })
})
