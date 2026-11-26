import type { SettingGateway } from '@settings/gateways/setting'

const LAST_BACKUP_AT_KEY = 'backup.lastBackupAt'
const LAST_DIRECTORY_KEY = 'backup.lastDirectory'

export interface BackupSettings {
  getLastBackupAt(): Promise<string | null>
  setLastBackupAt(value: string): Promise<void>
  getLastDirectory(): Promise<string | null>
  setLastDirectory(value: string): Promise<void>
}

export function backupSettings(gateway: SettingGateway): BackupSettings {
  async function read(key: string): Promise<string | null> {
    const row = await gateway.getByKey(key)
    return row ? row.value : null
  }

  async function write(key: string, value: string): Promise<void> {
    const updated = await gateway.update(key, value)
    if (!updated) {
      await gateway.create({ key, value })
    }
  }

  return {
    getLastBackupAt: () => read(LAST_BACKUP_AT_KEY),
    setLastBackupAt: (value) => write(LAST_BACKUP_AT_KEY, value),
    getLastDirectory: () => read(LAST_DIRECTORY_KEY),
    setLastDirectory: (value) => write(LAST_DIRECTORY_KEY, value)
  }
}
