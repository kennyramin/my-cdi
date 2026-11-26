import type Database from 'better-sqlite3'
import { hasPendingMigrations } from '../../helpers/migrationLevel'

const MIGRATION_REASON = 'migration' as const

interface BackupBeforeMigrationDeps {
  sqlite: Pick<Database.Database, 'prepare'>
  migrations: { folderMillis: number }[]
  createAutomaticBackup: (reason: 'migration') => Promise<string>
}

export async function backupBeforeMigration(
  deps: BackupBeforeMigrationDeps
): Promise<string | null> {
  if (!hasPendingMigrations(deps.sqlite, deps.migrations)) {
    return null
  }
  return deps.createAutomaticBackup(MIGRATION_REASON)
}
