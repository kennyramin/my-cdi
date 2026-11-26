import type Database from 'better-sqlite3'
import { dirname, join } from 'node:path'
import { formatLocalDate, formatLocalDateTime } from '@lib/localDateTime'
import type { BackupCreateResult } from '@backup-shared'
import type { BackupDialogs } from '../../ports'
import type { BackupSettings } from '../../settings/backupSettings'
import { createBackup } from '../createBackup'

const MANUAL_BACKUP_PREFIX = 'mon-cdi-'
const MANUAL_BACKUP_EXTENSION = '.db'

export interface RunManualBackupDeps {
  dialogs: BackupDialogs
  sqlite: Pick<Database.Database, 'backup' | 'name'>
  settings: BackupSettings
  documentsPath: string
  now: () => Date
}

export async function runManualBackup(deps: RunManualBackupDeps): Promise<BackupCreateResult> {
  const { dialogs, sqlite, settings, documentsPath, now } = deps
  const folder = (await settings.getLastDirectory()) ?? documentsPath
  const fileName = `${MANUAL_BACKUP_PREFIX}${formatLocalDate(now())}${MANUAL_BACKUP_EXTENSION}`

  const destination = await dialogs.pickSavePath({ defaultPath: join(folder, fileName) })
  if (destination === null) {
    return { cancelled: true }
  }

  await createBackup(sqlite, destination)
  await settings.setLastBackupAt(formatLocalDateTime(now()))
  await settings.setLastDirectory(dirname(destination))
  return { path: destination }
}
