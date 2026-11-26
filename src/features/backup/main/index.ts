import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { IpcMain } from 'electron'
import { SettingGatewayDrizzle } from '@settings/gateways/setting'
import { closeDbConnection } from '@shared/db/connection'
import { MIGRATIONS_FOLDER } from '@shared/db/migrate'
import type { AppLifecycle, BackupDialogs } from './ports'
import { getBackupRuntime } from './runtime'
import { registerBackupController } from './controllers/backup'
import { backupSettings } from './settings/backupSettings'
import { nodeFileOps } from './helpers/nodeFileOps'
import { applyRestore } from './helpers/applyRestore'
import { runManualBackup } from './use-cases/runManualBackup'
import { createRestoreSession } from './use-cases/restoreBackup'
import { getBackupStatus } from './use-cases/getBackupStatus'
import { createAutomaticBackup } from './use-cases/createAutomaticBackup'
import { deleteAutomaticBackups } from './use-cases/deleteAutomaticBackups'

export interface BackupModuleDeps {
  dialogs: BackupDialogs
  lifecycle: AppLifecycle
  documentsPath: string
  liveDbPath: string
}

export function initializeBackupModule(
  db: BetterSQLite3Database<Record<string, unknown>>,
  ipcMain: IpcMain,
  deps: BackupModuleDeps
): void {
  const { dialogs, lifecycle, documentsPath, liveDbPath } = deps
  const settings = backupSettings(new SettingGatewayDrizzle(db))
  const restoreSession = createRestoreSession({
    dialogs,
    settings,
    liveDbPath,
    migrationsFolder: MIGRATIONS_FOLDER,
    documentsPath,
    apply: (sourcePath) =>
      applyRestore({
        sourcePath,
        liveDbPath,
        createSafetyBackup: () => createAutomaticBackup('restore'),
        closeDatabase: closeDbConnection,
        files: nodeFileOps,
        lifecycle
      })
  })

  registerBackupController(ipcMain, {
    create: () => {
      const runtime = getBackupRuntime()
      return runManualBackup({
        dialogs,
        sqlite: runtime.getSqlite(),
        settings,
        documentsPath,
        now: runtime.now
      })
    },
    selectRestore: () => restoreSession.select(),
    confirmRestore: () => restoreSession.confirm(),
    getStatus: () => getBackupStatus({ settings, backupsDir: getBackupRuntime().backupsDir }),
    deleteAutomatic: () => deleteAutomaticBackups(getBackupRuntime().backupsDir)
  })
}
