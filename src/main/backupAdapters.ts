import { app, BrowserWindow, dialog } from 'electron'
import type { OpenDialogOptions } from 'electron'
import type { AppLifecycle, BackupDialogs } from '@backup/ports'

const SQLITE_FILTER = { name: 'SQLite', extensions: ['db'] }

// dialog.* and app.* are always reached through their objects at call time so tests can stub them
export function createElectronBackupDialogs(): BackupDialogs {
  return {
    async pickSavePath({ defaultPath }) {
      const options = { defaultPath, filters: [SQLITE_FILTER] }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) {
        return null
      }
      return result.filePath
    },
    async pickOpenPath({ defaultPath }) {
      const options: OpenDialogOptions = {
        defaultPath,
        properties: ['openFile'],
        filters: [SQLITE_FILTER]
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      const [filePath] = result.filePaths
      if (result.canceled || !filePath) {
        return null
      }
      return filePath
    }
  }
}

export function createElectronAppLifecycle(): AppLifecycle {
  return {
    relaunch() {
      app.relaunch()
      // Deferred so the IPC reply is flushed before the process goes away
      setImmediate(() => app.exit())
    }
  }
}
