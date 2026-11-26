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

let queue: Promise<unknown> = Promise.resolve()

// Runs tasks one after the other so concurrent callers never pick the same backup path
export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = result.catch(() => undefined)
  return result
}
