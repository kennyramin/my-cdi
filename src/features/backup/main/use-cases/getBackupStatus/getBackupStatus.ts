import type { BackupStatusDto } from '@backup-shared'
import type { BackupSettings } from '../../settings/backupSettings'
import { listAutomaticBackups } from '../listAutomaticBackups'

export interface GetBackupStatusDeps {
  settings: BackupSettings
  backupsDir: string
}

export async function getBackupStatus(deps: GetBackupStatusDeps): Promise<BackupStatusDto> {
  const { settings, backupsDir } = deps
  const [lastBackupAt, automatic] = await Promise.all([
    settings.getLastBackupAt(),
    listAutomaticBackups(backupsDir)
  ])
  return { lastBackupAt, automaticCount: automatic.length }
}
