import Database from 'better-sqlite3'
import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { AppError, ErrorCode } from '@lib/errors'
import { isLiveDatabasePath } from '../isLiveDatabasePath'
import { readBackupMigrationMillis } from '../migrationLevel'

const SQLITE_HEADER = 'SQLite format 3\0'
const HEADER_ENCODING = 'latin1'
const INTEGRITY_OK = 'ok'
const REQUIRED_TABLES = ['students', 'frequentation'] as const

interface ValidateBackupFileInput {
  filePath: string
  liveDbPath: string
  latestMigrationMillis: number
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

export function validateBackupFile(input: ValidateBackupFileInput): void {
  const { filePath, liveDbPath, latestMigrationMillis } = input
  if (!hasSqliteHeader(filePath)) {
    throw new AppError(ErrorCode.RESTORE_NOT_A_DATABASE, 'The file is not a SQLite database')
  }
  if (isLiveDatabasePath(liveDbPath, filePath)) {
    throw new AppError(ErrorCode.BACKUP_PATH_IS_LIVE_DB, 'The restore source is the live database')
  }
  const db = openReadOnly(filePath)
  try {
    if (!integrityIsOk(db)) {
      throw new AppError(ErrorCode.RESTORE_CORRUPTED, 'The backup failed the integrity check')
    }
    if (!hasRequiredTables(db)) {
      throw new AppError(ErrorCode.RESTORE_MISSING_TABLES, 'The backup lacks required tables')
    }
    const backupMillis = readBackupMigrationMillis(db)
    if (backupMillis !== null && backupMillis > latestMigrationMillis) {
      throw new AppError(
        ErrorCode.RESTORE_NEWER_VERSION,
        'The backup comes from a newer version of the application'
      )
    }
  } finally {
    db.close()
  }
}
