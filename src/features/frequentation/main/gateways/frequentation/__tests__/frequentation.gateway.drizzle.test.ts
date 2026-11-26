import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { ActivityType } from '@types'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { ErrorCode } from '@lib/errors'
import { updateFrequentation } from '@frequentation/use-cases/updateFrequentation'
import { FrequentationGatewayDrizzle } from '../frequentation.gateway.drizzle'
import type { FrequentationTx } from '../frequentation.gateway.drizzle'
import type { ExistingVisit } from '../helpers/findDuplicateMatches'

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

    it('getAll and getByStudentId fall back to students.classe when the snapshot is NULL', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_classe = NULL WHERE id = ?').run(visit.id)
      expect((await gateway.getAll())[0]?.studentClasse).toBe(FIRST_CLASS)
      expect((await gateway.getByStudentId(1))[0]?.studentClasse).toBe(FIRST_CLASS)
    })

    it('getAll and getByStudentId fall back to Classe inconnue when both are missing', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_classe = NULL WHERE id = ?').run(visit.id)
      sqlite.pragma('foreign_keys = OFF')
      sqlite.prepare('DELETE FROM students WHERE id = 1').run()
      expect((await gateway.getAll())[0]?.studentClasse).toBe(UNKNOWN_CLASS)
      expect((await gateway.getByStudentId(1))[0]?.studentClasse).toBe(UNKNOWN_CLASS)
    })

    it('getByDateRange includes an anonymized (student_id NULL) visit', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(visit.id)
      const results = await gateway.getByDateRange(VISIT_DAY, VISIT_DAY)
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        studentId: null,
        studentNom: null,
        studentClasse: FIRST_CLASS
      })
    })

    it('update with the same studentId keeps the old snapshot after a class change', async () => {
      const visit = await createVisit(1)
      sqlite.prepare('UPDATE students SET classe = ? WHERE id = 1').run(NEW_CLASS)
      await gateway.update(visit.id, { studentId: 1, activity: ActivityType.READING })
      expect(snapshotOf(visit.id)).toBe(FIRST_CLASS)
    })

    it('deleting a student still cascades its visits', async () => {
      await createVisit(1)
      sqlite.prepare('DELETE FROM students WHERE id = 1').run()
      expect(await gateway.count()).toBe(0)
    })
  })

  describe('anonymized visit through the update use-case', () => {
    const createAnonymizedVisit = async (): Promise<number> => {
      const visit = await gateway.create({
        startsAt: VISIT_START,
        activity: ActivityType.WORK,
        studentId: 1
      })
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(visit.id)
      return visit.id
    }

    it('cannot be re-linked to a student and stays anonymous', async () => {
      const id = await createAnonymizedVisit()

      const result = await updateFrequentation(gateway, id, { studentId: SECOND_STUDENT_ID })

      expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
      expect((await gateway.getById(id))?.studentId).toBeNull()
    })

    it('accepts an activity change and keeps it anonymous', async () => {
      const id = await createAnonymizedVisit()

      const result = await updateFrequentation(gateway, id, { activity: ActivityType.READING })

      expect(result.success).toBe(true)
      expect(await gateway.getById(id)).toMatchObject({
        studentId: null,
        activity: ActivityType.READING
      })
    })
  })

  describe('checked writes', () => {
    const BASE_DAY = '2026-01-15'
    const at = (time: string): string => `${BASE_DAY}T${time}`
    const unwrapWritten = <T>(result: { written: T } | { duplicates: unknown[] }): T => {
      if (!('written' in result)) {
        throw new Error('expected a written result')
      }
      return result.written
    }
    const visitCount = (): number =>
      (sqlite.prepare('SELECT COUNT(*) AS n FROM frequentation').get() as { n: number }).n
    const snapshotOf = (id: number): string | null =>
      (
        sqlite.prepare('SELECT student_classe AS c FROM frequentation WHERE id = ?').get(id) as {
          c: string | null
        }
      ).c
    const item = (studentId: number, time: string) => ({
      startsAt: at(time),
      activity: ActivityType.WORK,
      studentId
    })

    it("createManyChecked writes all and snapshots each student's class", async () => {
      const written = unwrapWritten(
        await gateway.createManyChecked(
          [item(1, '09:00:00'), item(SECOND_STUDENT_ID, '09:00:00')],
          {
            allowDuplicates: false
          }
        )
      )
      expect(written).toHaveLength(EXPECTED_TWO)
      expect(written.map((entry) => snapshotOf(entry.id))).toEqual([FIRST_CLASS, '5ème B'])
    })

    it('createManyChecked returns duplicates and writes nothing when one of several students is a duplicate', async () => {
      await gateway.create(item(1, '09:00:00'))
      await gateway.create(item(SECOND_STUDENT_ID, '09:10:00'))
      const before = visitCount()
      const result = await gateway.createManyChecked(
        [item(1, '09:05:00'), item(SECOND_STUDENT_ID, '09:05:00')],
        { allowDuplicates: false }
      )
      expect(result).toEqual({
        duplicates: [
          expect.objectContaining({ studentId: 1, existingId: 1 }),
          expect.objectContaining({ studentId: SECOND_STUDENT_ID, existingId: EXPECTED_TWO })
        ]
      })
      expect(visitCount()).toBe(before)
    })

    it('createManyChecked with allowDuplicates writes everything even with duplicates', async () => {
      await gateway.create(item(1, '09:00:00'))
      const result = await gateway.createManyChecked([item(1, '09:05:00')], {
        allowDuplicates: true
      })
      expect(unwrapWritten(result)).toHaveLength(1)
      expect(visitCount()).toBe(EXPECTED_TWO)
    })

    it('createManyChecked dedupes repeated studentIds in candidates', async () => {
      await gateway.create(item(1, '09:00:00'))
      const result = await gateway.createManyChecked([item(1, '09:05:00'), item(1, '09:06:00')], {
        allowDuplicates: false
      })
      expect(result).toEqual({ duplicates: expect.any(Array) })
      expect(visitCount()).toBe(1)
    })

    it('createManyChecked rolls back the whole batch when a later insert fails', async () => {
      await expect(
        gateway.createManyChecked([item(1, '09:00:00'), item(NONEXISTENT_ID, '10:00:00')], {
          allowDuplicates: false
        })
      ).rejects.toThrow()
      expect(visitCount()).toBe(0)
    })

    it('updateChecked excludes the edited entry from its own check', async () => {
      const own = await gateway.create(item(1, '09:00:00'))
      const result = await gateway.updateChecked(
        own.id,
        { startsAt: at('09:05:00') },
        { allowDuplicates: false }
      )
      expect(unwrapWritten(result)?.startsAt).toBe(at('09:05:00'))
    })

    it('updateChecked ignores anonymized rows', async () => {
      const own = await gateway.create(item(1, '10:00:00'))
      const anonymized = await gateway.create(item(SECOND_STUDENT_ID, '09:00:00'))
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(anonymized.id)
      const result = await gateway.updateChecked(
        own.id,
        { startsAt: at('09:00:00') },
        { allowDuplicates: false }
      )
      expect(unwrapWritten(result)?.startsAt).toBe(at('09:00:00'))
    })

    it('updateChecked student change refreshes the class snapshot', async () => {
      const own = await gateway.create(item(1, '09:00:00'))
      sqlite.prepare('UPDATE students SET classe = ? WHERE id = 1').run(NEW_CLASS)
      await gateway.updateChecked(own.id, { startsAt: at('11:00:00') }, { allowDuplicates: false })
      expect(snapshotOf(own.id)).toBe(FIRST_CLASS)
      await gateway.updateChecked(
        own.id,
        { studentId: SECOND_STUDENT_ID },
        { allowDuplicates: false }
      )
      expect(snapshotOf(own.id)).toBe('5ème B')
    })

    it('updateChecked returns { written: null } for unknown id', async () => {
      const result = await gateway.updateChecked(
        NONEXISTENT_ID,
        { startsAt: at('09:00:00') },
        { allowDuplicates: false }
      )
      expect(result).toEqual({ written: null })
    })

    it('updateChecked reports duplicates and leaves the entry untouched', async () => {
      await gateway.create(item(1, '09:00:00'))
      const own = await gateway.create(item(1, '12:00:00'))
      const result = await gateway.updateChecked(
        own.id,
        { startsAt: at('09:10:00') },
        { allowDuplicates: false }
      )
      expect(result).toEqual({
        duplicates: [expect.objectContaining({ studentId: 1, existingId: 1 })]
      })
      expect((await gateway.getById(own.id))?.startsAt).toBe(at('12:00:00'))
    })

    it('updateChecked skips the check when neither startsAt nor studentId changes', async () => {
      await gateway.create(item(1, '09:00:00'))
      const own = await gateway.create(item(1, '09:10:00'))
      const result = await gateway.updateChecked(
        own.id,
        { activity: ActivityType.READING },
        { allowDuplicates: false }
      )
      expect(unwrapWritten(result)?.activity).toBe(ActivityType.READING)
    })

    it('updateChecked with allowDuplicates writes despite duplicates', async () => {
      await gateway.create(item(1, '09:00:00'))
      const own = await gateway.create(item(1, '12:00:00'))
      const result = await gateway.updateChecked(
        own.id,
        { startsAt: at('09:10:00') },
        { allowDuplicates: true }
      )
      expect(unwrapWritten(result)?.startsAt).toBe(at('09:10:00'))
    })

    it('updateChecked never re-links an anonymized visit', async () => {
      const visit = await gateway.create(item(1, '09:00:00'))
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(visit.id)
      const result = await gateway.updateChecked(
        visit.id,
        { studentId: SECOND_STUDENT_ID, activity: ActivityType.READING },
        { allowDuplicates: false }
      )
      expect(unwrapWritten(result)?.studentId).toBeNull()
    })

    it('getWithStudentById returns the joined entry, anonymized-aware', async () => {
      const visit = await gateway.create(item(1, '09:00:00'))
      expect((await gateway.getWithStudentById(visit.id))?.studentNom).toBe('Dupont')
      sqlite.prepare('UPDATE frequentation SET student_id = NULL WHERE id = ?').run(visit.id)
      const anonymized = await gateway.getWithStudentById(visit.id)
      expect(anonymized?.studentNom).toBeNull()
      expect(anonymized?.studentClasse).toBe(FIRST_CLASS)
      expect(await gateway.getWithStudentById(NONEXISTENT_ID)).toBeNull()
    })
  })

  describe('atomicity', () => {
    class HookedGateway extends FrequentationGatewayDrizzle {
      afterLookup: () => void = () => undefined

      protected override findExisting(
        tx: FrequentationTx,
        studentIds: number[],
        days: string[]
      ): ExistingVisit[] {
        const rows = super.findExisting(tx, studentIds, days)
        this.afterLookup()
        return rows
      }
    }

    it('check and write hold one write lock (concurrent insert between check and write)', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'freq-lock-'))
      const file = join(dir, 'test.db')
      const first = new Database(file)
      first.pragma('foreign_keys = ON')
      migrateTestDatabase(first)
      first
        .prepare(
          `INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES ('A', 'B', '6ème A', '11111111A', 'n', 'n')`
        )
        .run()
      const second = new Database(file, { timeout: 0 })
      try {
        const hooked = new HookedGateway(drizzle(first))
        let concurrentError: unknown = null
        hooked.afterLookup = () => {
          try {
            second
              .prepare(
                `INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES ('2026-01-15T09:00:00', 'work', 1, 'n', 'n')`
              )
              .run()
          } catch (error) {
            concurrentError = error
          }
        }
        const result = await hooked.createManyChecked(
          [{ startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: 1 }],
          { allowDuplicates: false }
        )
        expect(concurrentError).toMatchObject({ code: 'SQLITE_BUSY' })
        expect(result).toEqual({ written: [expect.objectContaining({ studentId: 1 })] })
        const total = first.prepare('SELECT COUNT(*) AS n FROM frequentation').get() as {
          n: number
        }
        expect(total.n).toBe(1)
      } finally {
        second.close()
        first.close()
        rmSync(dir, { recursive: true, force: true })
      }
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
