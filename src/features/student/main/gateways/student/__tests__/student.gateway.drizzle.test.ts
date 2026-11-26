import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { StudentGatewayDrizzle } from '../student.gateway.drizzle'

const NONEXISTENT_ID = 9999
const EXPECTED_TWO_STUDENTS = 2
const EXPECTED_ONE_STUDENT = 1
const EXPECTED_THREE_VISITS = 3
const EXPECTED_TWO_VISITS = 2
const EXPECTED_ONE_VISIT = 1
const NO_VISITS = 0
const SINGLE_STATEMENT = 1

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite)

  migrateTestDatabase(sqlite)

  return { db, sqlite }
}

function insertVisit(sqlite: Database.Database, studentId: number): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run('2026-03-02T10:15:00', 'reading', studentId, now, now)
}

describe('StudentGatewayDrizzle', () => {
  let gateway: StudentGatewayDrizzle
  let sqlite: Database.Database

  beforeEach(() => {
    const { db, sqlite: sql } = createTestDb()
    sqlite = sql
    gateway = new StudentGatewayDrizzle(db)
  })

  afterEach(() => {
    sqlite.close()
  })

  describe('create', () => {
    it('creates a student and returns entity', async () => {
      const entity = await gateway.create({
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '3B',
        ine: '0123456789A'
      })
      expect(entity.id).toBeGreaterThan(0)
      expect(entity.nom).toBe('Dupont')
      expect(entity.prenom).toBe('Jean')
      expect(entity.classe).toBe('3B')
      expect(entity.ine).toBe('0123456789A')
    })
  })

  describe('getById', () => {
    it('returns student by id', async () => {
      const created = await gateway.create({
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '3B',
        ine: '0123456789A'
      })
      const found = await gateway.getById(created.id)
      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.nom).toBe('Dupont')
    })

    it('returns null for nonexistent id', async () => {
      const found = await gateway.getById(NONEXISTENT_ID)
      expect(found).toBeNull()
    })
  })

  describe('getAll', () => {
    it('returns all students', async () => {
      await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      await gateway.create({ nom: 'C', prenom: 'D', classe: '1A', ine: 'INE2' })
      const all = await gateway.getAll()
      expect(all).toHaveLength(EXPECTED_TWO_STUDENTS)
    })

    it('returns empty array when no students', async () => {
      const all = await gateway.getAll()
      expect(all).toHaveLength(0)
    })
  })

  describe('update', () => {
    it('updates specified fields', async () => {
      const created = await gateway.create({
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '3B',
        ine: '0123456789A'
      })
      const updated = await gateway.update(created.id, { nom: 'Martin' })
      expect(updated).not.toBeNull()
      expect(updated?.nom).toBe('Martin')
      expect(updated?.prenom).toBe('Jean')
    })

    it('returns null for nonexistent id', async () => {
      const updated = await gateway.update(NONEXISTENT_ID, { nom: 'Martin' })
      expect(updated).toBeNull()
    })
  })

  describe('delete', () => {
    it('deletes a student and returns true', async () => {
      const created = await gateway.create({
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '3B',
        ine: '0123456789A'
      })
      const deleted = await gateway.delete(created.id)
      expect(deleted).toBe(true)
      const found = await gateway.getById(created.id)
      expect(found).toBeNull()
    })

    it('returns false for nonexistent id', async () => {
      const deleted = await gateway.delete(NONEXISTENT_ID)
      expect(deleted).toBe(false)
    })
  })

  describe('getByIds', () => {
    it('returns students matching given ids', async () => {
      const s1 = await gateway.create({ nom: 'A', prenom: 'B', classe: '3B', ine: 'INE1' })
      const s2 = await gateway.create({ nom: 'C', prenom: 'D', classe: '3A', ine: 'INE2' })
      const result = await gateway.getByIds([s1.id, s2.id])
      expect(result).toHaveLength(EXPECTED_TWO_STUDENTS)
    })

    it('returns empty array for empty ids', async () => {
      const result = await gateway.getByIds([])
      expect(result).toHaveLength(0)
    })
  })

  describe('getAllWithVisitCount', () => {
    it('returns visitCount per student from frequentation rows', async () => {
      const a = await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      const b = await gateway.create({ nom: 'C', prenom: 'D', classe: '1A', ine: 'INE2' })
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, b.id)
      const rows = await gateway.getAllWithVisitCount()
      expect(rows.find((r) => r.id === a.id)?.visitCount).toBe(EXPECTED_THREE_VISITS)
      expect(rows.find((r) => r.id === b.id)?.visitCount).toBe(EXPECTED_ONE_VISIT)
    })

    it('returns visitCount 0 for students without frequentation', async () => {
      await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      const rows = await gateway.getAllWithVisitCount()
      expect(rows).toHaveLength(EXPECTED_ONE_STUDENT)
      expect(rows[0]?.visitCount).toBe(NO_VISITS)
      expect(rows[0]?.nom).toBe('A')
    })

    it('getAllWithVisitCount ignores anonymized visits', async () => {
      const a = await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      insertVisit(sqlite, a.id)
      sqlite
        .prepare(
          `INSERT INTO frequentation (starts_at, activity, student_id, student_classe, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)`
        )
        .run('2026-03-02T10:15:00', 'reading', '1A', '2026-03-02', '2026-03-02')
      const rows = await gateway.getAllWithVisitCount()
      expect(rows[0]?.visitCount).toBe(EXPECTED_ONE_VISIT)
    })

    it('filters by classe and still counts visits', async () => {
      const a = await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      const b = await gateway.create({ nom: 'C', prenom: 'D', classe: '3B', ine: 'INE2' })
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, b.id)
      const rows = await gateway.getAllWithVisitCount('3B')
      expect(rows).toHaveLength(EXPECTED_ONE_STUDENT)
      expect(rows[0]?.visitCount).toBe(EXPECTED_ONE_VISIT)
    })

    it('issues a single SQL statement', async () => {
      const a = await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      const b = await gateway.create({ nom: 'C', prenom: 'D', classe: '1A', ine: 'INE2' })
      const c = await gateway.create({ nom: 'E', prenom: 'F', classe: '1A', ine: 'INE3' })
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, b.id)
      insertVisit(sqlite, c.id)
      const prepareSpy = vi.spyOn(sqlite, 'prepare')
      await gateway.getAllWithVisitCount()
      expect(prepareSpy).toHaveBeenCalledTimes(SINGLE_STATEMENT)
    })
  })

  describe('countVisitsByStudentId', () => {
    it('counts the visits of a student', async () => {
      const a = await gateway.create({ nom: 'A', prenom: 'B', classe: '1A', ine: 'INE1' })
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, a.id)
      expect(await gateway.countVisitsByStudentId(a.id)).toBe(EXPECTED_TWO_VISITS)
    })

    it('returns 0 for an unknown student id', async () => {
      expect(await gateway.countVisitsByStudentId(NONEXISTENT_ID)).toBe(NO_VISITS)
    })
  })

  describe('anonymizeByIds', () => {
    const CHUNK_TEST_SIZE = 1200
    const EXISTING_SNAPSHOT = '4C'

    function insertSnapshotVisit(studentId: number, snapshot: string | null): void {
      const now = new Date().toISOString()
      sqlite
        .prepare(
          `INSERT INTO frequentation (starts_at, activity, student_id, student_classe, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('2026-03-02T10:15:00', 'reading', studentId, snapshot, now, now)
    }

    interface VisitRow {
      student_id: number | null
      student_classe: string | null
    }

    function visitRows(): VisitRow[] {
      return sqlite
        .prepare<[], VisitRow>('SELECT student_id, student_classe FROM frequentation ORDER BY id')
        .all()
    }

    function studentCount(): number {
      const row = sqlite.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM students').get()
      return row?.n ?? 0
    }

    async function seed(nom: string, ine: string, classe = '3B') {
      return gateway.create({ nom, prenom: 'Prenom', classe, ine })
    }

    it('anonymizes a student with visits: visits kept, student_id NULL, snapshot kept, student row gone', async () => {
      const s = await seed('Dupont', 'INE1')
      insertSnapshotVisit(s.id, '3B')
      insertSnapshotVisit(s.id, '3B')
      const result = await gateway.anonymizeByIds([s.id])
      expect(result).toEqual({ anonymized: EXPECTED_ONE_STUDENT, deletedWithoutVisits: 0 })
      expect(visitRows()).toEqual([
        { student_id: null, student_classe: '3B' },
        { student_id: null, student_classe: '3B' }
      ])
      expect(studentCount()).toBe(0)
    })

    it("sets the snapshot from the student's class when it was NULL", async () => {
      const s = await seed('Dupont', 'INE1', '5A')
      insertVisit(sqlite, s.id)
      await gateway.anonymizeByIds([s.id])
      expect(visitRows()).toEqual([{ student_id: null, student_classe: '5A' }])
    })

    it('keeps an existing snapshot different from the current class', async () => {
      const s = await seed('Dupont', 'INE1', '3B')
      insertSnapshotVisit(s.id, EXISTING_SNAPSHOT)
      await gateway.anonymizeByIds([s.id])
      expect(visitRows()).toEqual([{ student_id: null, student_classe: EXISTING_SNAPSHOT }])
    })

    it('student with 0 visits is deleted and counted in deletedWithoutVisits', async () => {
      const s = await seed('Dupont', 'INE1')
      const result = await gateway.anonymizeByIds([s.id])
      expect(result).toEqual({ anonymized: 0, deletedWithoutVisits: EXPECTED_ONE_STUDENT })
      expect(studentCount()).toBe(0)
    })

    it('mix of with/without visits', async () => {
      const a = await seed('A', 'INE1')
      const b = await seed('B', 'INE2')
      const c = await seed('C', 'INE3')
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, c.id)
      const result = await gateway.anonymizeByIds([a.id, b.id, c.id])
      expect(result).toEqual({ anonymized: EXPECTED_TWO_STUDENTS, deletedWithoutVisits: 1 })
      expect(studentCount()).toBe(0)
    })

    it('unknown ids are ignored by the gateway', async () => {
      const s = await seed('A', 'INE1')
      const result = await gateway.anonymizeByIds([s.id, NONEXISTENT_ID])
      expect(result).toEqual({ anonymized: 0, deletedWithoutVisits: EXPECTED_ONE_STUDENT })
    })

    it('empty list is a no-op returning zeros', async () => {
      await seed('A', 'INE1')
      const result = await gateway.anonymizeByIds([])
      expect(result).toEqual({ anonymized: 0, deletedWithoutVisits: 0 })
      expect(studentCount()).toBe(EXPECTED_ONE_STUDENT)
    })

    it('handles 1200 ids in chunks', async () => {
      const insert = sqlite.prepare(
        `INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      const now = new Date().toISOString()
      const ids: number[] = []
      for (let i = 0; i < CHUNK_TEST_SIZE; i++) {
        const info = insert.run(`N${i}`, 'P', '3B', `INE-${i}`, now, now)
        ids.push(Number(info.lastInsertRowid))
      }
      const [firstId] = ids
      if (firstId === undefined) {
        throw new Error('no ids')
      }
      insertVisit(sqlite, firstId)
      const result = await gateway.anonymizeByIds(ids)
      expect(result).toEqual({ anonymized: 1, deletedWithoutVisits: CHUNK_TEST_SIZE - 1 })
      expect(studentCount()).toBe(0)
    })

    it("other students' visits are untouched", async () => {
      const a = await seed('A', 'INE1')
      const b = await seed('B', 'INE2')
      insertVisit(sqlite, a.id)
      insertVisit(sqlite, b.id)
      await gateway.anonymizeByIds([a.id])
      const rows = visitRows()
      expect(rows.filter((r) => r.student_id === b.id)).toHaveLength(EXPECTED_ONE_VISIT)
      expect(rows.filter((r) => r.student_id === null)).toHaveLength(EXPECTED_ONE_VISIT)
      expect(rows.find((r) => r.student_id === b.id)?.student_classe).toBeNull()
    })

    it('no name, first name or INE remains anywhere in the database file', async () => {
      const surname = 'Zzyzxsurname'
      const firstName = 'Qwertyfirstname'
      const ine = 'INEZZ99887766'
      const s = await gateway.create({ nom: surname, prenom: firstName, classe: '3B', ine })
      insertVisit(sqlite, s.id)
      await gateway.anonymizeByIds([s.id])
      sqlite.exec('VACUUM')
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
      const dump = sqlite.serialize()
      for (const secret of [surname, firstName, ine]) {
        expect(dump.includes(Buffer.from(secret))).toBe(false)
      }
    })

    describe('atomicity', () => {
      function failDeletes(): void {
        sqlite.exec(
          `CREATE TRIGGER block_delete BEFORE DELETE ON students BEGIN SELECT RAISE(ABORT, 'blocked'); END`
        )
      }

      it('rolls back everything when the delete fails mid-way', async () => {
        const a = await seed('A', 'INE1')
        const b = await seed('B', 'INE2')
        insertVisit(sqlite, a.id)
        failDeletes()
        await expect(gateway.anonymizeByIds([a.id, b.id])).rejects.toThrow()
        expect(visitRows()).toEqual([{ student_id: a.id, student_classe: null }])
        expect(studentCount()).toBe(EXPECTED_TWO_STUDENTS)
      })

      it('withTransaction rolls back work and rethrows', async () => {
        const s = await seed('A', 'INE1')
        await expect(
          gateway.withTransaction(async () => {
            await gateway.delete(s.id)
            throw new Error('boom')
          })
        ).rejects.toThrow('boom')
        expect(studentCount()).toBe(EXPECTED_ONE_STUDENT)
      })

      it('withTransaction commits and returns the work result', async () => {
        const s = await seed('A', 'INE1')
        const result = await gateway.withTransaction(async () => gateway.delete(s.id))
        expect(result).toBe(true)
        expect(studentCount()).toBe(0)
      })

      it('anonymizeByIds inside withTransaction rolls back with the outer failure', async () => {
        const a = await seed('A', 'INE1')
        insertVisit(sqlite, a.id)
        await expect(
          gateway.withTransaction(async () => {
            await gateway.anonymizeByIds([a.id])
            throw new Error('outer failure')
          })
        ).rejects.toThrow('outer failure')
        expect(visitRows()).toEqual([{ student_id: a.id, student_classe: null }])
        expect(studentCount()).toBe(EXPECTED_ONE_STUDENT)
      })
    })
  })
})
