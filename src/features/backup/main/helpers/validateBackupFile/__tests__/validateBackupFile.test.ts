import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import { validateBackupFile } from '../validateBackupFile'

const MIGRATIONS_TABLE = '__drizzle_migrations'
const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle')
const ALL_MIGRATIONS = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
const LATEST_MILLIS = Math.max(...ALL_MIGRATIONS.map((m) => m.folderMillis))
const FORGET_LAST_MIGRATION = `DELETE FROM ${MIGRATIONS_TABLE} WHERE created_at = (SELECT MAX(created_at) FROM ${MIGRATIONS_TABLE})`
const NEWER_OFFSET_MS = 1
const SQLITE_HEADER_BYTES = 100
const PAGE_ROWS = 400
const PAYLOAD_LENGTH = 200
const PAGE_PAYLOAD = 'x'.repeat(PAYLOAD_LENGTH)
const CORRUPT_OFFSET = 4096
const CORRUPT_LENGTH = 8192
const CORRUPT_BYTE = 0xff
const PARTIAL_MIGRATIONS_COUNT = 2

interface MakeDbOptions {
  dropTables?: string[]
  extraMigrationMillis?: number
  migrationsFolder?: string
}

// Same as the application: a database migrated by drizzle with the real migration files
function makeDb(path: string, options: MakeDbOptions = {}): void {
  const { dropTables = [], extraMigrationMillis, migrationsFolder = MIGRATIONS_FOLDER } = options
  const db = new Database(path)
  try {
    migrate(drizzle(db), { migrationsFolder })
    for (const table of dropTables) {
      db.exec(`DROP TABLE ${table}`)
    }
    if (extraMigrationMillis !== undefined) {
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('x', ?)`).run(
        extraMigrationMillis
      )
    }
  } finally {
    db.close()
  }
}

function execOn(path: string, sql: string): void {
  const db = new Database(path)
  try {
    db.exec(sql)
  } finally {
    db.close()
  }
}

// An older release: only the first migrations exist in its journal
function makePartialMigrationsFolder(target: string): string {
  const folder = join(target, 'partial-migrations')
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')
  ) as { entries: { tag: string }[] }
  journal.entries = journal.entries.slice(0, PARTIAL_MIGRATIONS_COUNT)
  mkdirSync(join(folder, 'meta'), { recursive: true })
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify(journal))
  for (const entry of journal.entries) {
    copyFileSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
  }
  return folder
}

function makeBigDb(path: string): void {
  makeDb(path)
  const db = new Database(path)
  try {
    const insert = db.prepare(
      "INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES (?, 'p', 'c', ?, 'd', 'd')"
    )
    for (let i = 0; i < PAGE_ROWS; i += 1) {
      insert.run(`${PAGE_PAYLOAD}${i}`, `ine${i}`)
    }
  } finally {
    db.close()
  }
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function caughtCode(action: () => void): ErrorCode | null {
  try {
    action()
  } catch (error) {
    if (error instanceof AppError) {
      return error.code
    }
    throw error
  }
  return null
}

function expectCode(action: () => void, code: ErrorCode): void {
  expect(caughtCode(action)).toBe(code)
}

let dir: string
let livePath: string

function validate(filePath: string, migrationsFolder = MIGRATIONS_FOLDER): void {
  validateBackupFile({ filePath, liveDbPath: livePath, migrationsFolder })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'validate-backup-'))
  livePath = join(dir, 'live.db')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('validateBackupFile', () => {
  describe('accepts', () => {
    it('a valid current backup', () => {
      const path = join(dir, 'backup.db')
      makeDb(path)
      expect(() => validate(path)).not.toThrow()
    })

    it('an older-version backup', () => {
      const path = join(dir, 'older.db')
      makeDb(path)
      execOn(path, FORGET_LAST_MIGRATION)
      expect(() => validate(path)).not.toThrow()
    })

    it('a partially migrated backup that can be migrated forward', () => {
      const path = join(dir, 'partial.db')
      makeDb(path, { migrationsFolder: makePartialMigrationsFolder(dir) })
      expect(() => validate(path)).not.toThrow()
      const copy = join(dir, 'copy.db')
      copyFileSync(path, copy)
      const db = new Database(copy)
      try {
        expect(() => migrate(drizzle(db), { migrationsFolder: MIGRATIONS_FOLDER })).not.toThrow()
      } finally {
        db.close()
      }
    })

    it('without modifying the backup while dry-running the migrations', () => {
      const path = join(dir, 'partial-untouched.db')
      makeDb(path, { migrationsFolder: makePartialMigrationsFolder(dir) })
      const before = sha256(path)
      validate(path)
      expect(sha256(path)).toBe(before)
    })

    it('a backup at the equal schema level', () => {
      const path = join(dir, 'equal.db')
      makeDb(path)
      expect(() => validate(path)).not.toThrow()
    })

    it('a path with accents and apostrophes', () => {
      const folder = join(dir, "Été d'élève")
      mkdirSync(folder)
      const path = join(folder, "sauvegarde l'été.db")
      makeDb(path)
      expect(() => validate(path)).not.toThrow()
    })
  })

  describe('with a WAL-flagged backup made by the online backup API', () => {
    const WAL_FLAG_OFFSET = 18
    const WAL_FLAG = 2
    const READ_ONLY_DIR_MODE = 0o555
    const WRITABLE_DIR_MODE = 0o755

    async function makeWalBackup(path: string): Promise<void> {
      const source = new Database(join(dir, 'wal-source.db'))
      try {
        source.pragma('journal_mode = WAL')
        migrate(drizzle(source), { migrationsFolder: MIGRATIONS_FOLDER })
        await source.backup(path)
      } finally {
        source.close()
      }
    }

    it('validates without touching the file or its folder', async () => {
      const path = join(dir, 'wal-backup.db')
      await makeWalBackup(path)
      expect(readFileSync(path)[WAL_FLAG_OFFSET]).toBe(WAL_FLAG)
      const before = sha256(path)
      expect(() => validate(path)).not.toThrow()
      expect(sha256(path)).toBe(before)
      expect(existsSync(`${path}-wal`)).toBe(false)
      expect(existsSync(`${path}-shm`)).toBe(false)
    })

    it('validates from a read-only directory', async () => {
      const folder = join(dir, 'readonly')
      mkdirSync(folder)
      const path = join(folder, 'wal-backup.db')
      await makeWalBackup(path)
      chmodSync(folder, READ_ONLY_DIR_MODE)
      try {
        expect(() => validate(path)).not.toThrow()
        expect(existsSync(`${path}-wal`)).toBe(false)
        expect(existsSync(`${path}-shm`)).toBe(false)
      } finally {
        chmodSync(folder, WRITABLE_DIR_MODE)
      }
    })
  })

  describe('rejects as not a database', () => {
    it('a missing file', () => {
      expectCode(() => validate(join(dir, 'missing.db')), ErrorCode.RESTORE_NOT_A_DATABASE)
    })

    it('a directory', () => {
      const folder = join(dir, 'folder.db')
      mkdirSync(folder)
      expectCode(() => validate(folder), ErrorCode.RESTORE_NOT_A_DATABASE)
    })

    it('an empty file', () => {
      const path = join(dir, 'empty.db')
      writeFileSync(path, '')
      expectCode(() => validate(path), ErrorCode.RESTORE_NOT_A_DATABASE)
    })

    it('a text file renamed .db', () => {
      const path = join(dir, 'text.db')
      writeFileSync(path, 'this is definitely not a sqlite database file')
      expectCode(() => validate(path), ErrorCode.RESTORE_NOT_A_DATABASE)
    })

    it('a valid header followed by a garbage body with a typed error', () => {
      const real = join(dir, 'real.db')
      makeDb(real)
      const garbage = join(dir, 'garbage.db')
      const header = readFileSync(real).subarray(0, SQLITE_HEADER_BYTES)
      writeFileSync(garbage, Buffer.concat([header, Buffer.alloc(CORRUPT_LENGTH)]))
      const code = caughtCode(() => validate(garbage))
      expect([ErrorCode.RESTORE_NOT_A_DATABASE, ErrorCode.RESTORE_CORRUPTED]).toContain(code)
    })
  })

  it('rejects an integrity failure', () => {
    const path = join(dir, 'corrupt.db')
    makeBigDb(path)
    const fd = openSync(path, 'r+')
    try {
      writeSync(fd, Buffer.alloc(CORRUPT_LENGTH, CORRUPT_BYTE), 0, CORRUPT_LENGTH, CORRUPT_OFFSET)
    } finally {
      closeSync(fd)
    }
    expectCode(() => validate(path), ErrorCode.RESTORE_CORRUPTED)
  })

  describe('rejects missing tables', () => {
    it('without the students table', () => {
      const path = join(dir, 'no-students.db')
      makeDb(path, { dropTables: ['frequentation', 'students'] })
      execOn(path, 'CREATE TABLE frequentation (id INTEGER)')
      expectCode(() => validate(path), ErrorCode.RESTORE_MISSING_TABLES)
    })

    it('without the frequentation table', () => {
      const path = join(dir, 'no-frequentation.db')
      makeDb(path, { dropTables: ['frequentation'] })
      expectCode(() => validate(path), ErrorCode.RESTORE_MISSING_TABLES)
    })
  })

  describe('rejects an un-migratable backup', () => {
    it('without the migrations table', () => {
      const path = join(dir, 'no-migrations.db')
      makeDb(path)
      execOn(path, `DROP TABLE ${MIGRATIONS_TABLE}`)
      expectCode(() => validate(path), ErrorCode.RESTORE_UNKNOWN_SCHEMA)
    })

    it('with an empty migrations table', () => {
      const path = join(dir, 'empty-migrations.db')
      makeDb(path)
      execOn(path, `DELETE FROM ${MIGRATIONS_TABLE}`)
      expectCode(() => validate(path), ErrorCode.RESTORE_UNKNOWN_SCHEMA)
    })

    it('with a schema that conflicts with the pending migrations', () => {
      const path = join(dir, 'conflict.db')
      makeDb(path)
      execOn(path, `${FORGET_LAST_MIGRATION}; CREATE TABLE __new_frequentation (other TEXT)`)
      expectCode(() => validate(path), ErrorCode.RESTORE_MIGRATION_FAILED)
    })
  })

  it('rejects a backup from a newer schema', () => {
    const path = join(dir, 'newer.db')
    makeDb(path, { extraMigrationMillis: LATEST_MILLIS + NEWER_OFFSET_MS })
    expectCode(() => validate(path), ErrorCode.RESTORE_NEWER_VERSION)
  })

  describe('rejects the live database as restore source', () => {
    it('with the same path', () => {
      makeDb(livePath)
      expectCode(() => validate(livePath), ErrorCode.BACKUP_PATH_IS_LIVE_DB)
    })

    it('through a symlink', () => {
      makeDb(livePath)
      const link = join(dir, 'link.db')
      symlinkSync(livePath, link)
      expectCode(() => validate(link), ErrorCode.BACKUP_PATH_IS_LIVE_DB)
    })
  })

  it('does not modify the validated file nor create sidecar files', () => {
    const path = join(dir, 'untouched.db')
    makeDb(path)
    const before = sha256(path)
    validate(path)
    expect(sha256(path)).toBe(before)
    expect(existsSync(`${path}-wal`)).toBe(false)
    expect(existsSync(`${path}-shm`)).toBe(false)
  })
})
