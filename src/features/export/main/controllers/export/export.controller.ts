import type { IpcMain } from 'electron'
import { createMainRouter } from '@shared/ipc/router'
import { EXPORT_CHANNELS } from '@shared/ipc/channels'
import { unwrap } from '@shared/lib/use-case'
import type { ExportResultDto } from '@export-shared'
import { runExport, type RunExportDeps } from '../../use-cases/runExport'

export type IpcMainHandle = Pick<IpcMain, 'handle'>

export function registerExportController(ipcMain: IpcMainHandle, deps: RunExportDeps): void {
  const router = createMainRouter(ipcMain)

  router.procedure<unknown, ExportResultDto>(EXPORT_CHANNELS.RUN, async (input) =>
    unwrap(await runExport(deps, input))
  )
}
