import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getLatestMigrationMillis, hasPendingMigrations } from '../migrationLevel'

const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle')
const FIRST_MIGRATIONS_COUNT = 2
const NEWER_OFFSET_MS = 1

const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
const latest = Math.max(...migrations.map((m) => m.folderMillis))

let dir: string
let sqlite: Database.Database

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migration-level-'))
  sqlite = new Database(join(dir, 'test.db'))
})

afterEach(() => {
  sqlite.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('hasPendingMigrations', () => {
  it('is false for a fresh database', () => {
    expect(hasPendingMigrations(sqlite, migrations)).toBe(false)
  })

  it('is false for a fully migrated database', () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    expect(hasPendingMigrations(sqlite, migrations)).toBe(false)
  })

  it('is true when a newer migration exists', () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    const newer = [...migrations, { folderMillis: latest + NEWER_OFFSET_MS }]
    expect(hasPendingMigrations(sqlite, newer)).toBe(true)
  })

  it('is true when only the first 2 migrations were applied', () => {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    const keep = migrations.slice(0, FIRST_MIGRATIONS_COUNT)
    const cutoff = Math.max(...keep.map((m) => m.folderMillis))
    sqlite.prepare('DELETE FROM __drizzle_migrations WHERE created_at > ?').run(cutoff)
    expect(hasPendingMigrations(sqlite, migrations)).toBe(true)
  })

  it('is true for tables without a migrations table', () => {
    sqlite.exec('CREATE TABLE students (id INTEGER PRIMARY KEY)')
    expect(hasPendingMigrations(sqlite, migrations)).toBe(true)
  })

  it('is true when the migrations table is empty but tables exist', () => {
    sqlite.exec('CREATE TABLE students (id INTEGER PRIMARY KEY)')
    sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER, hash TEXT, created_at NUMERIC)')
    expect(hasPendingMigrations(sqlite, migrations)).toBe(true)
  })

  it('ignores sqlite_ internal tables', () => {
    sqlite.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    sqlite.exec('DROP TABLE t')
    sqlite.exec('CREATE TABLE sequence_holder (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    sqlite.exec('INSERT INTO sequence_holder DEFAULT VALUES')
    sqlite.exec('DROP TABLE sequence_holder')
    const internal = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'sqlite_%'")
      .all()
    expect(internal.length).toBeGreaterThan(0)
    expect(hasPendingMigrations(sqlite, migrations)).toBe(false)
  })
})

describe('getLatestMigrationMillis', () => {
  it("equals the last journal entry's when", () => {
    const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'))
    const whens: number[] = journal.entries.map((entry: { when: number }) => entry.when)
    expect(getLatestMigrationMillis(MIGRATIONS_FOLDER)).toBe(whens[whens.length - 1])
  })
})
