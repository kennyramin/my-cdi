import { basename } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import type { BackupDialogs } from '../../ports'
import type { BackupSettings } from '../../settings/backupSettings'
import { validateBackupFile } from '../../helpers/validateBackupFile'

export interface RestoreSessionDeps {
  dialogs: BackupDialogs
  settings: BackupSettings
  liveDbPath: string
  getLatestMigrationMillis: () => number
  documentsPath: string
  apply: (sourcePath: string) => Promise<void>
}

export interface RestoreSession {
  select(): Promise<{ cancelled: true } | { fileName: string }>
  confirm(): Promise<{ restored: true }>
}

// The renderer never sends a path: the main process remembers the file it validated
export function createRestoreSession(deps: RestoreSessionDeps): RestoreSession {
  const { dialogs, settings, liveDbPath, getLatestMigrationMillis, documentsPath, apply } = deps
  let selectedPath: string | null = null
  let latestSelectRequest = 0

  function validate(filePath: string): void {
    validateBackupFile({
      filePath,
      liveDbPath,
      latestMigrationMillis: getLatestMigrationMillis()
    })
  }

  return {
    async select() {
      selectedPath = null
      latestSelectRequest += 1
      const request = latestSelectRequest
      const defaultPath = (await settings.getLastDirectory()) ?? documentsPath
      const filePath = await dialogs.pickOpenPath({ defaultPath })
      if (filePath === null) {
        return { cancelled: true }
      }
      validate(filePath)
      // A newer select superseded this one while its dialog was open
      if (request !== latestSelectRequest) {
        return { cancelled: true }
      }
      selectedPath = filePath
      return { fileName: basename(filePath) }
    },

    async confirm() {
      const filePath = selectedPath
      // One shot: the selection is gone whether or not the restore succeeds
      selectedPath = null
      if (filePath === null) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'No backup file has been selected')
      }
      validate(filePath)
      await apply(filePath)
      return { restored: true }
    }
  }
}
