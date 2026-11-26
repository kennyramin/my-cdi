import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDbConnection, createDbConnection, getSqlite } from '@shared/db/connection'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { StudentGatewayDrizzle } from '../student.gateway.drizzle'

const SURNAME = 'Zzyzxsurname'
const FIRST_NAME = 'Qwertyfirstname'
const INE = 'INEZZ99887766'
const VISIT_COUNT = 3

describe('anonymization privacy (real file database, production connection)', () => {
  let dir: string

  afterEach(() => {
    closeDbConnection()
    rmSync(dir, { recursive: true, force: true })
  })

  it('leaves no name, first name or INE in the db file nor in the WAL file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-privacy-'))
    const dbPath = join(dir, 'database.db')
    const db = createDbConnection(dbPath)
    const sqlite = getSqlite()
    migrateTestDatabase(sqlite)

    const gateway = new StudentGatewayDrizzle(db)
    const student = await gateway.create({
      nom: SURNAME,
      prenom: FIRST_NAME,
      classe: '3B',
      ine: INE
    })
    const now = new Date().toISOString()
    for (let i = 0; i < VISIT_COUNT; i++) {
      sqlite
        .prepare(
          `INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .run('2026-03-02T10:15:00', 'reading', student.id, now, now)
    }
    // Make the insert frames reach the main file so a later delete leaves free pages behind
    sqlite.pragma('wal_checkpoint(TRUNCATE)')

    await gateway.anonymizeByIds([student.id])
    await gateway.checkpoint()

    // Raw bytes, read while the connection is open: no VACUUM, no checkpoint
    const files = [dbPath, `${dbPath}-wal`].filter((path) => existsSync(path))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const bytes = readFileSync(file)
      for (const secret of [SURNAME, FIRST_NAME, INE]) {
        expect(bytes.includes(Buffer.from(secret)), `${file} contains ${secret}`).toBe(false)
      }
    }
  })
})
