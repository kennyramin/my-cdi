import type Database from 'better-sqlite3'
import { existsSync, realpathSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'

const WAL_SUFFIX = '-wal'
const SHM_SUFFIX = '-shm'

function canonicalPath(path: string): string {
  const absolute = resolve(path)
  if (existsSync(absolute)) {
    return realpathSync(absolute)
  }
  const parent = dirname(absolute)
  if (existsSync(parent)) {
    return join(realpathSync(parent), basename(absolute))
  }
  return absolute
}

function isLiveDatabasePath(livePath: string, destinationPath: string): boolean {
  const destination = canonicalPath(destinationPath)
  return [livePath, `${livePath}${WAL_SUFFIX}`, `${livePath}${SHM_SUFFIX}`].some(
    (candidate) => canonicalPath(candidate) === destination
  )
}

export async function createBackup(
  sourceDb: Pick<Database.Database, 'backup' | 'name'>,
  destinationPath: string
): Promise<void> {
  if (isLiveDatabasePath(sourceDb.name, destinationPath)) {
    throw new AppError(
      ErrorCode.BACKUP_PATH_IS_LIVE_DB,
      'The backup destination is the live database'
    )
  }

  try {
    // SQLite refuses to write over a file that is not a database
    await rm(destinationPath, { force: true })
    await sourceDb.backup(destinationPath)
  } catch (error) {
    await rm(destinationPath, { force: true }).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    throw new AppError(ErrorCode.BACKUP_WRITE_FAILED, message, { cause: error })
  }
}
