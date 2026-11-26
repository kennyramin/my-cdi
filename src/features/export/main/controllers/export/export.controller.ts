import type { IpcMain } from 'electron'
import { createMainRouter } from '@shared/ipc/router'
import { EXPORT_CHANNELS } from '@shared/ipc/channels'
import { AppError, ErrorCode } from '@lib/errors'
import { unwrap } from '@shared/lib/use-case'
import type { ExportResultDto } from '@export-shared'
import { runExport, type RunExportDeps } from '../../use-cases/runExport'
import { exportRequestSchema } from '../../validations/exportRequestSchema'

export type IpcMainHandle = Pick<IpcMain, 'handle'>

const VALIDATION_FALLBACK_MESSAGE = 'Validation error'

export function registerExportController(ipcMain: IpcMainHandle, deps: RunExportDeps): void {
  const router = createMainRouter(ipcMain)

  router.procedure<unknown, ExportResultDto>(EXPORT_CHANNELS.RUN, async (input) => {
    const parsed = exportRequestSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? VALIDATION_FALLBACK_MESSAGE
      )
    }
    return unwrap(await runExport(deps, parsed.data))
  })
}
