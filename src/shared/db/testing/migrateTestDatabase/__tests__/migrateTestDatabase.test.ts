import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrateTestDatabase } from '../migrateTestDatabase'

const FIRST_MIGRATION_ONLY = 1
const TMP_PREFIX = 'my-cdi-migrations-'

function leftoverFolders(): string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith(TMP_PREFIX))
}

function tableNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .all()
    .map((row) => row.name)
}

describe('migrateTestDatabase', () => {
  it('applies only the requested number of migrations', () => {
    const sqlite = new Database(':memory:')
    migrateTestDatabase(sqlite, { upTo: FIRST_MIGRATION_ONLY })
    const names = tableNames(sqlite)
    expect(names).toContain('students')
    expect(names).not.toContain('frequentation')
    sqlite.close()
  })

  it('a second call applies the remaining ones', () => {
    const sqlite = new Database(':memory:')
    migrateTestDatabase(sqlite, { upTo: FIRST_MIGRATION_ONLY })
    migrateTestDatabase(sqlite)
    const names = tableNames(sqlite)
    expect(names).toContain('frequentation')
    expect(names).toContain('settings')
    sqlite.close()
  })

  it('leaves no temporary migrations folder behind', () => {
    const before = leftoverFolders()
    const sqlite = new Database(':memory:')
    migrateTestDatabase(sqlite)
    sqlite.close()
    expect(leftoverFolders()).toEqual(before)
  })
})
