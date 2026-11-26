import { AppError, ErrorCode } from '@lib/errors'
import type { AppLifecycle, FileOps } from '../../ports'

const RESTORE_TEMP_SUFFIX = '.restore-tmp'
const ROLLBACK_TEMP_SUFFIX = '.rollback-tmp'
const WAL_SUFFIX = '-wal'
const SHM_SUFFIX = '-shm'

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

function relaunchQuietly(lifecycle: AppLifecycle): void {
  try {
    lifecycle.relaunch()
  } catch {
    // The restore failure is the error worth reporting
  }
}

async function restoreFromSafety(
  files: FileOps,
  safetyPath: string,
  liveDbPath: string
): Promise<void> {
  const rollbackTemporaryPath = `${liveDbPath}${ROLLBACK_TEMP_SUFFIX}`
  try {
    // Copy beside the live file, then swap: a failed copy never truncates an intact live file
    await files.copyFile(safetyPath, rollbackTemporaryPath)
    await files.rename(rollbackTemporaryPath, liveDbPath)
  } catch (error) {
    await removeQuietly(files, rollbackTemporaryPath)
    throw error
  }
}

export async function applyRestore(deps: ApplyRestoreDeps): Promise<void> {
  const { sourcePath, liveDbPath, createSafetyBackup, closeDatabase, files, lifecycle } = deps
  const temporaryPath = `${liveDbPath}${RESTORE_TEMP_SUFFIX}`
  const walPath = `${liveDbPath}${WAL_SUFFIX}`
  const shmPath = `${liveDbPath}${SHM_SUFFIX}`

  // A failing safety backup aborts before anything is touched
  const safetyPath = await createSafetyBackup()

  // Live is untouched until the sidecars are removed: a failure here only needs temp cleanup
  try {
    closeDatabase()
    await files.copyFile(sourcePath, temporaryPath)
  } catch (error) {
    await removeQuietly(files, temporaryPath)
    relaunchQuietly(lifecycle)
    throw new AppError(ErrorCode.RESTORE_FAILED, messageOf(error), { cause: error })
  }

  try {
    await files.rm(walPath, { force: true })
    await files.rm(shmPath, { force: true })
    await files.rename(temporaryPath, liveDbPath)
  } catch (error) {
    // Live may have been modified: put the safety copy back
    let message = messageOf(error)
    await removeQuietly(files, temporaryPath)
    await removeQuietly(files, walPath)
    await removeQuietly(files, shmPath)
    try {
      await restoreFromSafety(files, safetyPath, liveDbPath)
    } catch (rollbackError) {
      message = `${message}; rollback failed (${messageOf(rollbackError)}), your data is in the safety backup: ${safetyPath}`
    }
    // The drizzle handles are closed: the app must restart to be usable again
    relaunchQuietly(lifecycle)
    throw new AppError(ErrorCode.RESTORE_FAILED, message, { cause: error })
  }

  lifecycle.relaunch()
}
