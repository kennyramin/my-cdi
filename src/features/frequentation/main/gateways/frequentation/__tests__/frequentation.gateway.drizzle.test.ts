import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { ActivityType } from '@types'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { FrequentationGatewayDrizzle } from '../frequentation.gateway.drizzle'

const NONEXISTENT_ID = 999
const EXPECTED_TWO = 2
const SECOND_STUDENT_ID = 2
const UNKNOWN_CLASS = 'Classe inconnue'
const FIRST_CLASS = '6ème A'
const NEW_CLASS = '5ème C'
const VISIT_DAY = '2026-01-15'
const VISIT_START = '2026-01-15T09:00:00.000Z'

function createTestDb(): { sqlite: Database.Database; db: ReturnType<typeof drizzle> } {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  migrateTestDatabase(sqlite)
  const now = '2026-01-01T00:00:00.000Z'
  sqlite
    .prepare(
      `INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run('Dupont', 'Jean', '6ème A', '12345678X', now, now)
  sqlite
    .prepare(
      `INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run('Martin', 'Marie', '5ème B', '87654321Y', now, now)
  return { sqlite, db: drizzle(sqlite) }
}

describe('FrequentationGatewayDrizzle', () => {
  let gateway: FrequentationGatewayDrizzle
  let sqlite: Database.Database

  beforeEach(() => {
    const testSetup = createTestDb()
    sqlite = testSetup.sqlite
    gateway = new FrequentationGatewayDrizzle(testSetup.db)
  })

  afterEach(() => {
    sqlite.close()
  })

  describe('create', () => {
    it('creates a frequentation and returns entity', async () => {
      const result = await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      expect(result.id).toBe(1)
      expect(result.startsAt).toBe('2026-01-15T09:00:00.000Z')
      expect(result.activity).toBe('work')
      expect(result.studentId).toBe(1)
    })
  })

  describe('getById', () => {
    it('returns frequentation by id', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      const result = await gateway.getById(1)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(1)
    })

    it('returns null for non-existent id', async () => {
      const result = await gateway.getById(NONEXISTENT_ID)
      expect(result).toBeNull()
    })
  })

  describe('getAll', () => {
    it('returns all frequentations with student data', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-15T10:00:00.000Z',
        activity: ActivityType.READING,
        studentId: SECOND_STUDENT_ID
      })
      const results = await gateway.getAll()
      expect(results).toHaveLength(EXPECTED_TWO)
      expect(results[0]?.studentNom).toBeDefined()
    })
  })

  describe('getByStudentId', () => {
    it('returns frequentations for a specific student', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-15T10:00:00.000Z',
        activity: ActivityType.READING,
        studentId: SECOND_STUDENT_ID
      })
      const results = await gateway.getByStudentId(1)
      expect(results).toHaveLength(1)
      expect(results[0]?.studentId).toBe(1)
    })
  })

  describe('getByDateRange', () => {
    it('returns frequentations within date range', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-20T10:00:00.000Z',
        activity: ActivityType.READING,
        studentId: SECOND_STUDENT_ID
      })
      const results = await gateway.getByDateRange('2026-01-15', '2026-01-15')
      expect(results).toHaveLength(1)
    })
  })

  describe('update', () => {
    it('updates activity field', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      const result = await gateway.update(1, { activity: ActivityType.READING })
      expect(result).not.toBeNull()
      expect(result?.activity).toBe('reading')
    })

    it('returns null for non-existent id', async () => {
      const result = await gateway.update(NONEXISTENT_ID, { activity: ActivityType.READING })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('deletes a frequentation', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      const deleted = await gateway.delete(1)
      expect(deleted).toBe(true)
      const found = await gateway.getById(1)
      expect(found).toBeNull()
    })

    it('returns false for non-existent id', async () => {
      const result = await gateway.delete(NONEXISTENT_ID)
      expect(result).toBe(false)
    })
  })

  describe('deleteByStudentId', () => {
    it('deletes all frequentations for a student', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-15T10:00:00.000Z',
        activity: ActivityType.READING,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-15T11:00:00.000Z',
        activity: ActivityType.COMPUTER,
        studentId: SECOND_STUDENT_ID
      })
      const count = await gateway.deleteByStudentId(1)
      expect(count).toBe(EXPECTED_TWO)
    })
  })

  describe('class snapshot', () => {
    const snapshotOf = (id: number): string | null => {
      const row = sqlite
        .prepare('SELECT student_classe AS c FROM frequentation WHERE id = ?')
        .get(id)
      return (row as { c: string | null }).c
    }
    const createVisit = (studentId: number): Promise<{ id: number }> =>
      gateway.create({ startsAt: VISIT_START, activity: ActivityType.WORK, studentId })

    it("create stores the student's current class as snapshot", async () => {
      const visit = await createVisit(1)
      expect(snapshotOf(visit.id)).toBe(FIRST_CLASS)
    })

    it("update with a new studentId re-snapshots that student's class", async () => {
      const visit = await createVisit(1)
      await gateway.update(visit.id, { studentId: SECOND_STUDENT_ID })
      expect(snapshotOf(visit.id)).toBe('5ème B')
    })

    it('update without studentId leaves the snapshot untouched', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE students SET classe = ? WHERE id = 1').run(NEW_CLASS)
      await gateway.update(visit.id, { activity: ActivityType.READING })
      expect(snapshotOf(visit.id)).toBe(FIRST_CLASS)
    })

    it('editing a student class never rewrites snapshots', async () => {
      await createVisit(1)
      sqlite.prepare('UPDATE students SET classe = ? WHERE id = 1').run(NEW_CLASS)
      const results = await gateway.getByDateRange(VISIT_DAY, VISIT_DAY)
      expect(results[0]?.studentClasse).toBe(FIRST_CLASS)
    })

    it('new entries after a class change get the new class', async () => {
      await createVisit(1)
      sqlite.prepare('UPDATE students SET classe = ? WHERE id = 1').run(NEW_CLASS)
      const visit = await createVisit(1)
      expect(snapshotOf(visit.id)).toBe(NEW_CLASS)
    })

    it('getByDateRange falls back to students.classe when the snapshot is NULL', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_classe = NULL WHERE id = ?').run(visit.id)
      const results = await gateway.getByDateRange(VISIT_DAY, VISIT_DAY)
      expect(results[0]?.studentClasse).toBe(FIRST_CLASS)
    })

    it('getByDateRange falls back to Classe inconnue when both are missing', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_classe = NULL WHERE id = ?').run(visit.id)
      sqlite.pragma('foreign_keys = OFF')
      sqlite.prepare('DELETE FROM students WHERE id = 1').run()
      const results = await gateway.getByDateRange(VISIT_DAY, VISIT_DAY)
      expect(results[0]?.studentClasse).toBe(UNKNOWN_CLASS)
    })

    it('orphan visit is anonymized with Classe inconnue', async () => {
      sqlite.pragma('foreign_keys = OFF')
      sqlite
        .prepare(
          `INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, 'work', 999, ?, ?)`
        )
        .run(VISIT_START, VISIT_START, VISIT_START)
      const results = await gateway.getByDateRange(VISIT_DAY, VISIT_DAY)
      expect(results).toHaveLength(1)
      expect(results[0]?.studentNom).toBeNull()
      expect(results[0]?.studentClasse).toBe(UNKNOWN_CLASS)
    })

    it('anonymized row (student_id NULL) maps with null identity and its snapshot class', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(visit.id)
      const results = await gateway.getAll()
      expect(results[0]).toMatchObject({
        studentId: null,
        studentNom: null,
        studentPrenom: null,
        studentIne: null,
        studentClasse: FIRST_CLASS
      })
    })

    it('deleting a student still cascades its visits', async () => {
      await createVisit(1)
      sqlite.prepare('DELETE FROM students WHERE id = 1').run()
      expect(await gateway.count()).toBe(0)
    })
  })

  describe('retention', () => {
    it('does not expose a purge method', () => {
      expect('deleteOlderThan' in gateway).toBe(false)
    })
  })

  describe('count', () => {
    it('returns total frequentation count', async () => {
      await gateway.create({
        startsAt: '2026-01-15T09:00:00.000Z',
        activity: ActivityType.WORK,
        studentId: 1
      })
      await gateway.create({
        startsAt: '2026-01-15T10:00:00.000Z',
        activity: ActivityType.READING,
        studentId: SECOND_STUDENT_ID
      })
      const result = await gateway.count()
      expect(result).toBe(EXPECTED_TWO)
    })
  })
})
