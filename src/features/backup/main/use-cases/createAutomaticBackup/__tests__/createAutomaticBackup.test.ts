import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { AutomaticBackupReason } from '@backup-shared'
import { AppError, ErrorCode } from '@lib/errors'
import { buildAutomaticBackupName } from '../../../helpers/backupFileName'
import { configureBackupRuntime } from '../../../runtime'
import { listAutomaticBackups } from '../../listAutomaticBackups'
import {
  AUTOMATIC_BACKUP_MAX_AGE_DAYS,
  AUTOMATIC_BACKUP_MAX_COUNT,
  createAutomaticBackup
} from '../createAutomaticBackup'

vi.mock('../../listAutomaticBackups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../listAutomaticBackups')>()
  return { ...actual, listAutomaticBackups: vi.fn(actual.listAutomaticBackups) }
})

const { listAutomaticBackups: realList } = await vi.importActual<
  typeof import('../../listAutomaticBackups')
>('../../listAutomaticBackups')

const NOW = new Date('2026-11-25T14:30:07')
const STUCK_AGE_DAYS = 35
const MS_PER_MINUTE = 60_000
const SEED_ROWS = 3
const EXTRA_RECENT_FILES = 12
const EXPECTED_OLDEST_GONE = 3

function daysBefore(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function seed(dir: string, date: Date, reason: AutomaticBackupReason = 'migration'): string {
  const path = join(dir, buildAutomaticBackupName(date, reason))
  writeFileSync(path, 'seed')
  return path
}

function countStudents(path: string): number {
  const db = new Database(path, { readonly: true })
  try {
    return db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM students').get()?.n ?? 0
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
    vi.restoreAllMocks()
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

  it('reports an unusable backups folder as BACKUP_WRITE_FAILED', async () => {
    writeFileSync(backupsDir, 'a file where the folder should be')

    const failure = await createAutomaticBackup('migration').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AppError)
    expect(failure).toMatchObject({ code: ErrorCode.BACKUP_WRITE_FAILED })
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

  describe('restore safety copies', () => {
    const RESTORE_COPIES_KEPT = 3
    const RESTORE_COPIES_SEEDED = 5

    it('are not pruned by age nor counted in the automatic cap', async () => {
      mkdirSync(backupsDir)
      const ancient = seed(
        backupsDir,
        daysBefore(NOW, AUTOMATIC_BACKUP_MAX_AGE_DAYS + 5),
        'restore'
      )
      const recent = Array.from({ length: AUTOMATIC_BACKUP_MAX_COUNT + 2 }, (_, index) =>
        seed(backupsDir, new Date(NOW.getTime() - (index + 1) * MS_PER_MINUTE))
      )

      await createAutomaticBackup('migration')

      expect(existsSync(ancient)).toBe(true)
      expect(recent.filter((path) => existsSync(path))).toHaveLength(AUTOMATIC_BACKUP_MAX_COUNT - 1)
    })

    it('are limited to the 3 most recent', async () => {
      mkdirSync(backupsDir)
      const seeded = Array.from({ length: RESTORE_COPIES_SEEDED }, (_, index) =>
        seed(backupsDir, daysBefore(NOW, index + 1), 'restore')
      )

      await createAutomaticBackup('migration')

      expect(seeded.filter((path) => existsSync(path))).toEqual(
        seeded.slice(0, RESTORE_COPIES_KEPT)
      )
    })
  })

  it('never deletes the file it just wrote', async () => {
    mkdirSync(backupsDir)
    for (let i = 1; i <= AUTOMATIC_BACKUP_MAX_COUNT; i += 1) {
      seed(backupsDir, new Date(NOW.getTime() - i * MS_PER_MINUTE))
    }

    const path = await createAutomaticBackup('migration')

    expect(existsSync(path)).toBe(true)
  })

  it('ignores future-dated files when applying the count cap', async () => {
    mkdirSync(backupsDir)
    const future = Array.from({ length: AUTOMATIC_BACKUP_MAX_COUNT }, (_, index) =>
      seed(backupsDir, new Date(NOW.getTime() + (index + 1) * MS_PER_MINUTE))
    )
    const recent = seed(backupsDir, new Date(NOW.getTime() - MS_PER_MINUTE))

    const path = await createAutomaticBackup('migration')

    expect(existsSync(path)).toBe(true)
    expect(existsSync(recent)).toBe(true)
    for (const file of future) {
      expect(existsSync(file)).toBe(true)
    }
  })

  it('resolves with the new path when an old entry cannot be removed', async () => {
    mkdirSync(backupsDir)
    // rm without `recursive` rejects on a directory, standing in for EPERM/EBUSY
    const stuck = join(
      backupsDir,
      buildAutomaticBackupName(daysBefore(NOW, STUCK_AGE_DAYS), 'migration')
    )
    mkdirSync(join(stuck, 'child'), { recursive: true })
    const removable = seed(backupsDir, daysBefore(NOW, STUCK_AGE_DAYS + 1))
    vi.mocked(listAutomaticBackups).mockImplementationOnce(async (dir) => [
      ...(await realList(dir)),
      { name: 'stuck', path: stuck, date: daysBefore(NOW, STUCK_AGE_DAYS), reason: 'migration' }
    ])

    const path = await createAutomaticBackup('migration')

    expect(existsSync(path)).toBe(true)
    expect(existsSync(stuck)).toBe(true)
    expect(existsSync(removable)).toBe(false)
  })

  it('resolves with the new path when the backups folder cannot be listed', async () => {
    vi.mocked(listAutomaticBackups).mockRejectedValueOnce(new Error('EIO'))

    const path = await createAutomaticBackup('migration')

    expect(existsSync(path)).toBe(true)
  })

  it('serializes concurrent calls so they write distinct files', async () => {
    const [first, second] = await Promise.all([
      createAutomaticBackup('migration'),
      createAutomaticBackup('migration')
    ])

    expect(first).not.toBe(second)
    expect(existsSync(first)).toBe(true)
    expect(existsSync(second)).toBe(true)
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

  it('throws when the backup cannot be written', async () => {
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
