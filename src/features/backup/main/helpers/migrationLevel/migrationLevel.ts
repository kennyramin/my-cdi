import type Database from 'better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'

const MIGRATIONS_TABLE = '__drizzle_migrations'
const INTERNAL_TABLE_PATTERN = 'sqlite_%'

interface UserTableRow {
  name: string
}

interface AppliedRow {
  created_at: number | string | null
}

export function getLatestMigrationMillis(migrationsFolder: string): number {
  return Math.max(...readMigrationFiles({ migrationsFolder }).map((m) => m.folderMillis))
}

// Mirrors drizzle's migrator: only the most recent applied row is compared to each migration
export function hasPendingMigrations(
  sqlite: Pick<Database.Database, 'prepare'>,
  migrations: { folderMillis: number }[]
): boolean {
  const userTables: UserTableRow[] = sqlite
    .prepare<[string], UserTableRow>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE ?"
    )
    .all(INTERNAL_TABLE_PATTERN)
  const appTables = userTables.filter((table) => table.name !== MIGRATIONS_TABLE)
  if (appTables.length === 0) {
    return false
  }
  if (!userTables.some((table) => table.name === MIGRATIONS_TABLE)) {
    return true
  }
  const last = sqlite
    .prepare<[], AppliedRow>(
      `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`
    )
    .get()
  if (!last || last.created_at === null) {
    return true
  }
  const lastApplied = Number(last.created_at)
  return migrations.some((migration) => lastApplied < migration.folderMillis)
}
