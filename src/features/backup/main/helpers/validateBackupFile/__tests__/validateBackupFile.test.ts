import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import {
  chmodSync,
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

const LATEST_MILLIS = 1_700_000_000_000
const OLDER_OFFSET_MS = 1000
const OLDER_MILLIS = LATEST_MILLIS - OLDER_OFFSET_MS
const NEWER_OFFSET_MS = 1
const SQLITE_HEADER_BYTES = 100
const PAGE_ROWS = 400
const PAYLOAD_LENGTH = 200
const PAGE_PAYLOAD = 'x'.repeat(PAYLOAD_LENGTH)
const CORRUPT_OFFSET = 4096
const CORRUPT_LENGTH = 8192
const CORRUPT_BYTE = 0xff
const REQUIRED_TABLES = ['students', 'frequentation']

interface MakeDbOptions {
  tables?: string[]
  migrationMillis?: number | null
}

function makeDb(path: string, options: MakeDbOptions = {}): void {
  const { tables = REQUIRED_TABLES, migrationMillis = LATEST_MILLIS } = options
  const db = new Database(path)
  try {
    for (const table of tables) {
      db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, name TEXT)`)
    }
    if (migrationMillis !== null) {
      db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, created_at NUMERIC)')
      db.prepare('INSERT INTO __drizzle_migrations (created_at) VALUES (?)').run(migrationMillis)
    }
  } finally {
    db.close()
  }
}

function makeBigDb(path: string): void {
  makeDb(path)
  const db = new Database(path)
  try {
    const insert = db.prepare('INSERT INTO students (name) VALUES (?)')
    for (let i = 0; i < PAGE_ROWS; i += 1) {
      insert.run(`${PAGE_PAYLOAD}${i}`)
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

function validate(filePath: string, latestMigrationMillis = LATEST_MILLIS): void {
  validateBackupFile({ filePath, liveDbPath: livePath, latestMigrationMillis })
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
      makeDb(path, { migrationMillis: OLDER_MILLIS })
      expect(() => validate(path)).not.toThrow()
    })

    it('a backup without any migrations table', () => {
      const path = join(dir, 'legacy.db')
      makeDb(path, { migrationMillis: null })
      expect(() => validate(path)).not.toThrow()
    })

    it('a backup at the equal schema level', () => {
      const path = join(dir, 'equal.db')
      makeDb(path, { migrationMillis: LATEST_MILLIS })
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
        source.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)')
        source.exec('CREATE TABLE frequentation (id INTEGER PRIMARY KEY, name TEXT)')
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
      makeDb(path, { tables: ['frequentation'] })
      expectCode(() => validate(path), ErrorCode.RESTORE_MISSING_TABLES)
    })

    it('without the frequentation table', () => {
      const path = join(dir, 'no-frequentation.db')
      makeDb(path, { tables: ['students'] })
      expectCode(() => validate(path), ErrorCode.RESTORE_MISSING_TABLES)
    })
  })

  it('rejects a backup from a newer schema', () => {
    const path = join(dir, 'newer.db')
    makeDb(path, { migrationMillis: LATEST_MILLIS + NEWER_OFFSET_MS })
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
