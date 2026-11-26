import type Database from 'better-sqlite3'

export interface BackupRuntime {
  getSqlite: () => Pick<Database.Database, 'backup' | 'name'>
  backupsDir: string
  now: () => Date
}

let current: BackupRuntime | null = null

export function configureBackupRuntime(runtime: BackupRuntime): void {
  current = runtime
}

export function getBackupRuntime(): BackupRuntime {
  if (!current) {
    throw new Error('Backup runtime not configured')
  }
  return current
}
