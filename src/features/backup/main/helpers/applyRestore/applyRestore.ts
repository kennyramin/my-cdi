import { copyFile, rename, rm } from 'node:fs/promises'
import { AppError, ErrorCode } from '@lib/errors'
import type { AppLifecycle, FileOps } from '../../ports'

const RESTORE_TEMP_SUFFIX = '.restore-tmp'
const WAL_SUFFIX = '-wal'
const SHM_SUFFIX = '-shm'

export const nodeFileOps: FileOps = { copyFile, rename, rm }

export interface ApplyRestoreDeps {
  sourcePath: string
  liveDbPath: string
  createSafetyBackup: () => Promise<string>
  closeDatabase: () => void
  files: FileOps
  lifecycle: AppLifecycle
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function removeQuietly(files: FileOps, path: string): Promise<void> {
  await files.rm(path, { force: true }).catch(() => undefined)
}

export async function applyRestore(deps: ApplyRestoreDeps): Promise<void> {
  const { sourcePath, liveDbPath, createSafetyBackup, closeDatabase, files, lifecycle } = deps
  const temporaryPath = `${liveDbPath}${RESTORE_TEMP_SUFFIX}`
  const walPath = `${liveDbPath}${WAL_SUFFIX}`
  const shmPath = `${liveDbPath}${SHM_SUFFIX}`

  // A failing safety backup aborts before anything is touched
  const safetyPath = await createSafetyBackup()

  try {
    closeDatabase()
    await files.copyFile(sourcePath, temporaryPath)
    await files.rm(walPath, { force: true })
    await files.rm(shmPath, { force: true })
    await files.rename(temporaryPath, liveDbPath)
  } catch (error) {
    await removeQuietly(files, temporaryPath)
    await removeQuietly(files, walPath)
    await removeQuietly(files, shmPath)
    let message = messageOf(error)
    try {
      await files.copyFile(safetyPath, liveDbPath)
    } catch (rollbackError) {
      message = `${message}; rollback failed (${messageOf(rollbackError)}), your data is in the safety backup: ${safetyPath}`
    }
    // The drizzle handles are closed: the app must restart to be usable again
    lifecycle.relaunch()
    throw new AppError(ErrorCode.RESTORE_FAILED, message, { cause: error })
  }

  lifecycle.relaunch()
}
