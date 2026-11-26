import Database from 'better-sqlite3'
import { closeSync, copyFileSync, mkdtempSync, openSync, readSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { AppError, ErrorCode } from '@lib/errors'
import { isLiveDatabasePath } from '../isLiveDatabasePath'
import { getLatestMigrationMillis, readBackupMigrationMillis } from '../migrationLevel'

const SQLITE_HEADER = 'SQLite format 3\0'
const HEADER_ENCODING = 'latin1'
const INTEGRITY_OK = 'ok'
const TEMP_DIR_PREFIX = 'validate-backup-'
const COPY_NAME = 'candidate.db'
const REQUIRED_TABLES = ['students', 'frequentation'] as const

interface ValidateBackupFileInput {
  filePath: string
  liveDbPath: string
  migrationsFolder: string
}

function hasSqliteHeader(filePath: string): boolean {
  try {
    if (!statSync(filePath).isFile()) {
      return false
    }
    const fd = openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(SQLITE_HEADER.length)
      const bytesRead = readSync(fd, buffer, 0, buffer.length, 0)
      return bytesRead === buffer.length && buffer.toString(HEADER_ENCODING) === SQLITE_HEADER
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
}

function integrityIsOk(db: Database.Database): boolean {
  try {
    return db.pragma('integrity_check', { simple: true }) === INTEGRITY_OK
  } catch {
    return false
  }
}

function hasRequiredTables(db: Database.Database): boolean {
  const rows = db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
  const names = new Set(rows.map((row) => row.name))
  return REQUIRED_TABLES.every((table) => names.has(table))
}

function openReadOnly(filePath: string): Database.Database {
  try {
    return new Database(filePath, { readonly: true, fileMustExist: true })
  } catch (error) {
    throw new AppError(
      ErrorCode.RESTORE_NOT_A_DATABASE,
      'The file cannot be opened as a database',
      {
        cause: error
      }
    )
  }
}

function inspectDatabase(copyPath: string, latestMigrationMillis: number): void {
  const db = openReadOnly(copyPath)
  try {
    if (!integrityIsOk(db)) {
      throw new AppError(ErrorCode.RESTORE_CORRUPTED, 'The backup failed the integrity check')
    }
    if (!hasRequiredTables(db)) {
      throw new AppError(ErrorCode.RESTORE_MISSING_TABLES, 'The backup lacks required tables')
    }
    const backupMillis = readBackupMigrationMillis(db)
    // Without migration rows the next start would re-run every migration on existing tables
    if (backupMillis === null) {
      throw new AppError(
        ErrorCode.RESTORE_UNKNOWN_SCHEMA,
        'The backup has no migration information'
      )
    }
    if (backupMillis > latestMigrationMillis) {
      throw new AppError(
        ErrorCode.RESTORE_NEWER_VERSION,
        'The backup comes from a newer version of the application'
      )
    }
  } finally {
    db.close()
  }
}

// The same migrator the application runs at startup, applied to the throwaway copy
function dryRunMigrations(copyPath: string, migrationsFolder: string): void {
  const db = new Database(copyPath, { fileMustExist: true })
  try {
    migrate(drizzle(db), { migrationsFolder })
  } catch (error) {
    throw new AppError(
      ErrorCode.RESTORE_MIGRATION_FAILED,
      'The backup cannot be migrated to the current version',
      { cause: error }
    )
  } finally {
    db.close()
  }
}

function copyToScratch(filePath: string, scratchDir: string): string {
  const copyPath = join(scratchDir, COPY_NAME)
  try {
    copyFileSync(filePath, copyPath)
  } catch (error) {
    throw new AppError(ErrorCode.RESTORE_NOT_A_DATABASE, 'The file cannot be read', {
      cause: error
    })
  }
  return copyPath
}

// Validates a throwaway copy: opening a WAL-flagged backup would create -wal/-shm beside it
export function validateBackupFile(input: ValidateBackupFileInput): void {
  const { filePath, liveDbPath, migrationsFolder } = input
  if (!hasSqliteHeader(filePath)) {
    throw new AppError(ErrorCode.RESTORE_NOT_A_DATABASE, 'The file is not a SQLite database')
  }
  if (isLiveDatabasePath(liveDbPath, filePath)) {
    throw new AppError(ErrorCode.BACKUP_PATH_IS_LIVE_DB, 'The restore source is the live database')
  }
  const scratchDir = mkdtempSync(join(tmpdir(), TEMP_DIR_PREFIX))
  try {
    const copyPath = copyToScratch(filePath, scratchDir)
    inspectDatabase(copyPath, getLatestMigrationMillis(migrationsFolder))
    dryRunMigrations(copyPath, migrationsFolder)
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }
}
