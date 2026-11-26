import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import { isLiveDatabasePath } from '../../helpers/isLiveDatabasePath'

const TEMP_SUFFIX = '.tmp'
const TEMP_RANDOM_BYTES = 6

function temporaryPathFor(destinationPath: string): string {
  const random = randomBytes(TEMP_RANDOM_BYTES).toString('hex')
  return join(dirname(destinationPath), `.${basename(destinationPath)}.${random}${TEMP_SUFFIX}`)
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

  // Write next to the destination, then rename: an existing destination survives any failure
  const temporaryPath = temporaryPathFor(destinationPath)
  try {
    await sourceDb.backup(temporaryPath)
    await rename(temporaryPath, destinationPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    throw new AppError(ErrorCode.BACKUP_WRITE_FAILED, message, { cause: error })
  }
}
