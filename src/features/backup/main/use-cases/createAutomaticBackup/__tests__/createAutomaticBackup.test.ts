import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { buildAutomaticBackupName } from '../../../helpers/backupFileName'
import { configureBackupRuntime } from '../../../runtime'
import {
  AUTOMATIC_BACKUP_MAX_AGE_DAYS,
  AUTOMATIC_BACKUP_MAX_COUNT,
  createAutomaticBackup
} from '../createAutomaticBackup'

const NOW = new Date('2026-11-25T14:30:07')
const MS_PER_MINUTE = 60_000
const SEED_ROWS = 3
const EXTRA_RECENT_FILES = 12
const EXPECTED_OLDEST_GONE = 3

function daysBefore(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function seed(dir: string, date: Date): string {
  const path = join(dir, buildAutomaticBackupName(date, 'restore'))
  writeFileSync(path, 'seed')
  return path
}

function countStudents(path: string): number {
  const db = new Database(path, { readonly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }
    return row.n
  } finally {
    db.close()
  }
}

describe('createAutomaticBackup', () => {
  let root: string
  let backupsDir: string
  let db: Database.Database

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'my-cdi-auto-'))
    backupsDir = join(root, 'backups')
    db = new Database(join(root, 'live.db'))
    db.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    for (let i = 0; i < SEED_ROWS; i += 1) {
      db.prepare('INSERT INTO students (name) VALUES (?)').run(`s-${i}`)
    }
    configureBackupRuntime({ getSqlite: () => db, backupsDir, now: () => NOW })
  })

  afterEach(() => {
    db.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('writes a valid backup and returns its path', async () => {
    const path = await createAutomaticBackup('migration')

    expect(basename(path)).toBe('auto-20261125-143007-migration.db')
    expect(countStudents(path)).toBe(SEED_ROWS)
  })

  it('creates the backups folder when missing', async () => {
    expect(existsSync(backupsDir)).toBe(false)
    const path = await createAutomaticBackup('restore')
    expect(existsSync(path)).toBe(true)
  })

  it('never overwrites a backup written in the same second', async () => {
    const first = await createAutomaticBackup('migration')
    const second = await createAutomaticBackup('migration')

    expect(second).not.toBe(first)
    expect(basename(second)).toBe('auto-20261125-143008-migration.db')
    expect(existsSync(first)).toBe(true)
    expect(existsSync(second)).toBe(true)
  })

  it('prunes backups older than 30 days', async () => {
    mkdirSync(backupsDir)
    const old = seed(backupsDir, daysBefore(NOW, AUTOMATIC_BACKUP_MAX_AGE_DAYS + 1))
    const boundary = seed(backupsDir, daysBefore(NOW, AUTOMATIC_BACKUP_MAX_AGE_DAYS))

    await createAutomaticBackup('migration')

    expect(existsSync(old)).toBe(false)
    expect(existsSync(boundary)).toBe(true)
  })

  it('keeps at most 10 files, newest first', async () => {
    mkdirSync(backupsDir)
    const seeded = Array.from({ length: EXTRA_RECENT_FILES }, (_, index) =>
      seed(backupsDir, new Date(NOW.getTime() - (index + 1) * MS_PER_MINUTE))
    )

    const path = await createAutomaticBackup('migration')

    expect(readdirSync(backupsDir)).toHaveLength(AUTOMATIC_BACKUP_MAX_COUNT)
    expect(existsSync(path)).toBe(true)
    for (const gone of seeded.slice(-EXPECTED_OLDEST_GONE)) {
      expect(existsSync(gone)).toBe(false)
    }
    expect(existsSync(seeded[0] ?? '')).toBe(true)
  })

  it('never deletes the file it just wrote', async () => {
    mkdirSync(backupsDir)
    // Newer than "now": the new file sorts below the cap but must survive
    for (let i = 1; i <= AUTOMATIC_BACKUP_MAX_COUNT; i += 1) {
      seed(backupsDir, new Date(NOW.getTime() + i * MS_PER_MINUTE))
    }

    const path = await createAutomaticBackup('migration')

    expect(existsSync(path)).toBe(true)
  })

  it('ignores files and directories not matching the pattern', async () => {
    mkdirSync(backupsDir)
    writeFileSync(join(backupsDir, 'notes.txt'), '')
    writeFileSync(join(backupsDir, 'auto-foo.db'), '')
    mkdirSync(join(backupsDir, 'auto-20200101-000000-restore.db'))

    await createAutomaticBackup('migration')

    expect(existsSync(join(backupsDir, 'notes.txt'))).toBe(true)
    expect(existsSync(join(backupsDir, 'auto-foo.db'))).toBe(true)
    expect(existsSync(join(backupsDir, 'auto-20200101-000000-restore.db'))).toBe(true)
  })

  it('throws when the backup cannot be written and prunes nothing', async () => {
    const blocker = join(root, 'blocker')
    writeFileSync(blocker, 'file')
    configureBackupRuntime({
      getSqlite: () => db,
      backupsDir: join(blocker, 'backups'),
      now: () => NOW
    })

    await expect(createAutomaticBackup('migration')).rejects.toThrow()
  })

  it('does not prune when the new backup failed', async () => {
    mkdirSync(backupsDir)
    const old = seed(backupsDir, daysBefore(NOW, AUTOMATIC_BACKUP_MAX_AGE_DAYS + 5))
    configureBackupRuntime({
      getSqlite: () => ({
        name: db.name,
        backup: () => Promise.reject(new Error('disk full'))
      }),
      backupsDir,
      now: () => NOW
    })

    await expect(createAutomaticBackup('migration')).rejects.toThrow()
    expect(existsSync(old)).toBe(true)
  })
})
