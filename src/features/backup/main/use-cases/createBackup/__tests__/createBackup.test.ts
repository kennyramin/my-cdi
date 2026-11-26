import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import { createBackup } from '../createBackup'

const SQLITE_HEADER = 'SQLite format 3\0'
const SEED_ROWS = 3
const WAL_ROWS = 5
const JOURNAL_FLAG_OFFSET = 18
const DELETE_MODE_FLAG = 1

function countStudents(path: string): number {
  const db = new Database(path, { readonly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }
    return row.n
  } finally {
    db.close()
  }
}

function insertStudents(db: Database.Database, count: number): void {
  const insert = db.prepare('INSERT INTO students (name) VALUES (?)')
  for (let i = 0; i < count; i += 1) {
    insert.run(`student-${i}`)
  }
}

async function expectAppError(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(error).toBeInstanceOf(AppError)
  expect(error).toMatchObject({ code })
}

describe('createBackup', () => {
  let dir: string
  let livePath: string
  let db: Database.Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-backup-'))
    livePath = join(dir, 'live.db')
    db = new Database(livePath)
    db.pragma('journal_mode = WAL')
    db.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    insertStudents(db, SEED_ROWS)
  })

  afterEach(() => {
    if (db.open) {
      db.close()
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes a valid SQLite copy', async () => {
    const dest = join(dir, 'copy.db')

    await createBackup(db, dest)

    expect(readFileSync(dest).subarray(0, SQLITE_HEADER.length).toString('latin1')).toBe(
      SQLITE_HEADER
    )
    expect(countStudents(dest)).toBe(SEED_ROWS)
  })

  it('writes a self-contained copy that is not WAL-flagged', async () => {
    const dest = join(dir, 'copy.db')

    await createBackup(db, dest)

    const bytes = readFileSync(dest)
    expect(bytes[JOURNAL_FLAG_OFFSET]).toBe(DELETE_MODE_FLAG)
    expect(bytes[JOURNAL_FLAG_OFFSET + 1]).toBe(DELETE_MODE_FLAG)
    expect(existsSync(`${dest}-wal`)).toBe(false)
    expect(existsSync(`${dest}-shm`)).toBe(false)
  })

  it('includes rows still in the WAL', async () => {
    db.pragma('wal_autocheckpoint = 0')
    insertStudents(db, WAL_ROWS)
    const dest = join(dir, 'copy.db')

    await createBackup(db, dest)

    expect(countStudents(dest)).toBe(SEED_ROWS + WAL_ROWS)
  })

  it('backs up to a path with accents and apostrophes', async () => {
    const dest = join(dir, "Sauvegarde élève d'été.db")

    await createBackup(db, dest)

    expect(countStudents(dest)).toBe(SEED_ROWS)
  })

  it('overwrites an existing destination', async () => {
    const dest = join(dir, 'copy.db')
    writeFileSync(dest, 'garbage')

    await createBackup(db, dest)

    expect(countStudents(dest)).toBe(SEED_ROWS)
  })

  describe('refuses the live database path', () => {
    async function expectRefused(dest: string): Promise<void> {
      await expectAppError(createBackup(db, dest), ErrorCode.BACKUP_PATH_IS_LIVE_DB)
      expect(db.prepare('SELECT COUNT(*) AS n FROM students').get()).toEqual({ n: SEED_ROWS })
      db.close()
      expect(countStudents(livePath)).toBe(SEED_ROWS)
    }

    it('for the exact path', async () => {
      await expectRefused(livePath)
    })

    it('for a ..-normalised path to the same file', async () => {
      await expectRefused(`${dir}/sub/../live.db`)
    })

    it('for a relative path to the same file', async () => {
      await expectRefused(relative(process.cwd(), livePath))
    })

    it('for a symlink to the live file', async () => {
      const link = join(dir, 'link.db')
      symlinkSync(livePath, link)
      await expectRefused(link)
    })

    it('for the -wal sidecar', async () => {
      await expectRefused(`${livePath}-wal`)
    })

    it('for the -shm sidecar', async () => {
      await expectRefused(`${livePath}-shm`)
    })
  })

  describe('reports an unwritable destination as BACKUP_WRITE_FAILED', () => {
    it('when the parent folder is missing', async () => {
      await expectAppError(
        createBackup(db, join(dir, 'missing', 'copy.db')),
        ErrorCode.BACKUP_WRITE_FAILED
      )
    })

    it('when the parent is a regular file', async () => {
      const parent = join(dir, 'not-a-folder')
      writeFileSync(parent, 'x')
      await expectAppError(createBackup(db, join(parent, 'copy.db')), ErrorCode.BACKUP_WRITE_FAILED)
    })
  })

  it('reports a directory destination as BACKUP_WRITE_FAILED and leaves it untouched', async () => {
    const dest = join(dir, 'a-folder')
    mkdirSync(dest)
    writeFileSync(join(dest, 'keep.txt'), 'x')

    await expectAppError(createBackup(db, dest), ErrorCode.BACKUP_WRITE_FAILED)

    expect(readdirSync(dest)).toEqual(['keep.txt'])
  })

  describe('when the backup fails midway', () => {
    const failing = (): Pick<Database.Database, 'backup' | 'name'> => ({
      name: livePath,
      backup: async (path: string) => {
        writeFileSync(path, 'partial')
        throw new Error('SQLITE_FULL')
      }
    })

    it('leaves no file behind', async () => {
      const target = join(dir, 'sub-target')
      mkdirSync(target)

      await expectAppError(
        createBackup(failing(), join(target, 'partial.db')),
        ErrorCode.BACKUP_WRITE_FAILED
      )

      expect(readdirSync(target)).toEqual([])
    })

    it.each([
      ['garbage bytes', 'garbage'],
      ['a valid database', null]
    ])('keeps an existing destination holding %s intact', async (_label, bytes) => {
      const target = join(dir, 'sub-target')
      mkdirSync(target)
      const dest = join(target, 'existing.db')
      if (bytes === null) {
        await createBackup(db, dest)
      } else {
        writeFileSync(dest, bytes)
      }
      const original = readFileSync(dest)

      await expectAppError(createBackup(failing(), dest), ErrorCode.BACKUP_WRITE_FAILED)

      expect(readFileSync(dest).equals(original)).toBe(true)
      expect(readdirSync(target)).toEqual(['existing.db'])
    })
  })
})
