import { afterEach, describe, expect, it } from 'vitest'
import { closeDbConnection, createDbConnection, getSqlite } from '../connection'

describe('getSqlite', () => {
  afterEach(() => {
    closeDbConnection()
  })

  it('throws before createDbConnection', () => {
    expect(() => getSqlite()).toThrow('Database not initialized')
  })

  it('returns the raw better-sqlite3 handle (has .name and .backup)', () => {
    createDbConnection(':memory:')
    const sqlite = getSqlite()
    expect(sqlite.name).toBe(':memory:')
    expect(typeof sqlite.backup).toBe('function')
  })
})
