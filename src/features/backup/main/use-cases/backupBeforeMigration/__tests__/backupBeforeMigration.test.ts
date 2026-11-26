import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupBeforeMigration } from '../backupBeforeMigration'

const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle')
const BACKUP_PATH = '/backups/auto-migration.db'
const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
const latest = Math.max(...migrations.map((m) => m.folderMillis))
const NEWER_OFFSET_MS = 1

let dir: string
let sqlite: Database.Database

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'backup-before-migration-'))
  sqlite = new Database(join(dir, 'test.db'))
})

afterEach(() => {
  sqlite.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('backupBeforeMigration', () => {
  it('does not call createAutomaticBackup on a fresh DB', async () => {
    const createAutomaticBackup = vi.fn().mockResolvedValue(BACKUP_PATH)
    const result = await backupBeforeMigration({ sqlite, migrations, createAutomaticBackup })
    expect(result).toBeNull()
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it('does not call it when up to date', async () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    const createAutomaticBackup = vi.fn().mockResolvedValue(BACKUP_PATH)
    const result = await backupBeforeMigration({ sqlite, migrations, createAutomaticBackup })
    expect(result).toBeNull()
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it("calls it with 'migration' once when pending and returns the path", async () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    const createAutomaticBackup = vi.fn().mockResolvedValue(BACKUP_PATH)
    const pending = [...migrations, { folderMillis: latest + NEWER_OFFSET_MS }]
    const result = await backupBeforeMigration({
      sqlite,
      migrations: pending,
      createAutomaticBackup
    })
    expect(result).toBe(BACKUP_PATH)
    expect(createAutomaticBackup).toHaveBeenCalledTimes(1)
    expect(createAutomaticBackup).toHaveBeenCalledWith('migration')
  })

  it('propagates the failure', async () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    const createAutomaticBackup = vi.fn().mockRejectedValue(new Error('disk full'))
    const pending = [...migrations, { folderMillis: latest + NEWER_OFFSET_MS }]
    await expect(
      backupBeforeMigration({ sqlite, migrations: pending, createAutomaticBackup })
    ).rejects.toThrow('disk full')
  })
})
