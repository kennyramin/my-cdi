import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const MIGRATIONS_FOLDER = resolve(__dirname, '../../../../../drizzle')
const JOURNAL_PATH = join('meta', '_journal.json')
const TMP_PREFIX = 'my-cdi-migrations-'
const SQL_EXTENSION = '.sql'
const JSON_INDENT = 2

interface JournalEntry {
  tag: string
}

interface Journal {
  entries: JournalEntry[]
}

interface MigrateTestDatabaseOptions {
  upTo?: number
}

export function migrateTestDatabase(
  sqlite: Database.Database,
  options: MigrateTestDatabaseOptions = {}
): void {
  const journal: Journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, JOURNAL_PATH), 'utf8'))
  const entries = journal.entries.slice(0, options.upTo ?? journal.entries.length)

  const folder = mkdtempSync(join(tmpdir(), TMP_PREFIX))
  try {
    mkdirSync(join(folder, 'meta'))
    for (const entry of entries) {
      cpSync(
        join(MIGRATIONS_FOLDER, `${entry.tag}${SQL_EXTENSION}`),
        join(folder, `${entry.tag}${SQL_EXTENSION}`)
      )
    }
    writeFileSync(
      join(folder, JOURNAL_PATH),
      JSON.stringify({ ...journal, entries }, null, JSON_INDENT)
    )

    migrate(drizzle(sqlite), { migrationsFolder: folder })
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}
