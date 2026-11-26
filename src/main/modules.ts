import log from 'electron-log/main'
import { app, BrowserWindow, dialog, type IpcMain } from 'electron'
import { getDb } from '@shared/db/connection'
import { initializeStudentModule } from '@student/index'
import { initializeFrequentationModule } from '@frequentation/index'
import { initializeStatisticsModule } from '@statistics/index'
import { initializeExportModule } from '@export/index'
import {
  createElectronExportFileAdapter,
  nodeExportFs
} from '@export/adapters/electronExportFileAdapter'
import { initializeSettingsModule } from '@settings/index'
import { createAutomaticBackup } from '@backup/use-cases/createAutomaticBackup'
import { initializeBackupModule, type BackupModuleDeps } from '@backup/index'

export async function initializeModules(
  ipcMain: IpcMain,
  backupDeps: BackupModuleDeps
): Promise<void> {
  const db = getDb()
  const studentGateway = initializeStudentModule(db, ipcMain, { createAutomaticBackup })
  const frequentationGateway = initializeFrequentationModule(db, ipcMain, studentGateway)
  initializeStatisticsModule(ipcMain, frequentationGateway)
  // dialog.* and BrowserWindow.* are reached through their objects at call time so tests can stub them
  const exportFileAdapter = createElectronExportFileAdapter({
    dialog: {
      showSaveDialog: (parent, options) =>
        parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options)
    },
    fs: nodeExportFs,
    getParentWindow: () => BrowserWindow.getFocusedWindow(),
    getDefaultDirectory: () => app.getPath('documents'),
    logger: log
  })
  initializeExportModule(ipcMain, frequentationGateway, studentGateway, exportFileAdapter)
  initializeSettingsModule(db, ipcMain)
  initializeBackupModule(db, ipcMain, backupDeps)
}
