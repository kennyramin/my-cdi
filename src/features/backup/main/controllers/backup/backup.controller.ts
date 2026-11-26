import type { IpcMain } from 'electron'
import { createMainRouter } from '@shared/ipc/router'
import { BACKUP_CHANNELS } from '@shared/ipc/channels'
import { AppError, ErrorCode } from '@lib/errors'
import {
  restoreInputSchema,
  type BackupCreateResult,
  type BackupStatusDto,
  type DeleteAutomaticResultDto,
  type RestoreResult
} from '@backup-shared'

export type IpcMainHandle = Pick<IpcMain, 'handle'>

export interface BackupHandlers {
  create(): Promise<BackupCreateResult>
  selectRestore(): Promise<{ cancelled: true } | { fileName: string }>
  confirmRestore(): Promise<{ restored: true }>
  getStatus(): Promise<BackupStatusDto>
  deleteAutomatic(): Promise<DeleteAutomaticResultDto>
}

export function registerBackupController(ipcMain: IpcMainHandle, handlers: BackupHandlers): void {
  const router = createMainRouter(ipcMain)

  router.procedure<void, BackupCreateResult>(BACKUP_CHANNELS.CREATE, () => handlers.create())

  router.procedure<unknown, RestoreResult>(BACKUP_CHANNELS.RESTORE, async (input) => {
    const parsed = restoreInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message)
    }
    if (parsed.data.phase === 'select') {
      return handlers.selectRestore()
    }
    return handlers.confirmRestore()
  })

  router.procedure<void, BackupStatusDto>(BACKUP_CHANNELS.GET_STATUS, () => handlers.getStatus())

  router.procedure<void, DeleteAutomaticResultDto>(BACKUP_CHANNELS.DELETE_AUTOMATIC, () =>
    handlers.deleteAutomatic()
  )
}
