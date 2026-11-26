import type { IpcMain } from 'electron'
import { getDb } from '@shared/db/connection'
import { initializeStudentModule } from '@student/index'
import { initializeFrequentationModule } from '@frequentation/index'
import { initializeStatisticsModule } from '@statistics/index'
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
  initializeSettingsModule(db, ipcMain)
  initializeBackupModule(db, ipcMain, backupDeps)
}
