import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { normalizeLegacyStartsAt, STARTS_AT_LOCAL_DONE_KEY } from '../normalizeLegacyStartsAt'

const CREATED_AT = '2026-01-01T00:00:00.000Z'
const UPDATED_AT = '2026-01-02T00:00:00.000Z'
const THIRD_ROW_INDEX = 2
const EXPECTED_TWO = 2
const EXPECTED_THREE = 3
const BACKUP_PATH = '/tmp/x.db'

function createDb(): Database.Database {
  const sqlite = new Database(':memory:')
  migrateTestDatabase(sqlite)
  return sqlite
}

function insertVisit(sqlite: Database.Database, startsAt: string): number {
  const info = sqlite
    .prepare(
      `INSERT INTO frequentation (starts_at, activity, student_id, student_classe, created_at, updated_at) VALUES (?, 'work', NULL, '6A', ?, ?)`
    )
    .run(startsAt, CREATED_AT, UPDATED_AT)
  return Number(info.lastInsertRowid)
}

function startsAtOf(sqlite: Database.Database, id: number): string {
  const row = sqlite
    .prepare<[number], { starts_at: string }>('SELECT starts_at FROM frequentation WHERE id = ?')
    .get(id)
  return row?.starts_at ?? ''
}

function flagValue(sqlite: Database.Database): string | undefined {
  const row = sqlite
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get(STARTS_AT_LOCAL_DONE_KEY)
  return row?.value
}

describe('normalizeLegacyStartsAt', () => {
  let sqlite: Database.Database
  let createAutomaticBackup: ReturnType<typeof vi.fn<(reason: 'normalization') => Promise<string>>>
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }

  const run = () => normalizeLegacyStartsAt(sqlite, { createAutomaticBackup, logger })

  async function convert(input: string): Promise<string> {
    const id = insertVisit(sqlite, input)
    await run()
    return startsAtOf(sqlite, id)
  }

  beforeEach(() => {
    sqlite = createDb()
    createAutomaticBackup = vi.fn<(reason: 'normalization') => Promise<string>>()
    createAutomaticBackup.mockResolvedValue(BACKUP_PATH)
    logger = { info: vi.fn(), warn: vi.fn() }
  })

  it('converts a Z timestamp', async () => {
    expect(await convert('2026-05-01T07:30:00.000Z')).toBe('2026-05-01T09:30:00')
  })

  it('converts Z without milliseconds', async () => {
    expect(await convert('2026-05-01T07:30:00Z')).toBe('2026-05-01T09:30:00')
  })

  it('converts a +01:00 offset', async () => {
    expect(await convert('2026-01-10T09:30:00+01:00')).toBe('2026-01-10T09:30:00')
  })

  it('converts a +02:00 offset in summer', async () => {
    expect(await convert('2026-07-10T09:30:00+02:00')).toBe('2026-07-10T09:30:00')
  })

  it('converts a colon-less offset', async () => {
    expect(await convert('2026-07-10T09:30:00+0200')).toBe('2026-07-10T09:30:00')
  })

  it('converts a negative offset', async () => {
    expect(await convert('2026-01-10T09:30:00-05:00')).toBe('2026-01-10T15:30:00')
  })

  it('leaves an already-local string untouched', async () => {
    const regular = insertVisit(sqlite, '2026-05-01T09:30:00')
    const inGap = insertVisit(sqlite, '2026-03-29T02:30:00')
    insertVisit(sqlite, '2026-05-01T07:30:00.000Z')

    await run()

    expect(startsAtOf(sqlite, regular)).toBe('2026-05-01T09:30:00')
    expect(startsAtOf(sqlite, inGap)).toBe('2026-03-29T02:30:00')
  })

  it('leaves an unparseable string untouched and counts it', async () => {
    const bad = insertVisit(sqlite, 'not-a-date')
    const badZ = insertVisit(sqlite, '2026-13-45T25:00:00Z')
    insertVisit(sqlite, '2026-05-01T07:30:00.000Z')

    const result = await run()

    expect(startsAtOf(sqlite, bad)).toBe('not-a-date')
    expect(startsAtOf(sqlite, badZ)).toBe('2026-13-45T25:00:00Z')
    expect(result).toEqual({ status: 'converted', converted: 1, unparseable: EXPECTED_TWO })
  })

  it('logs counts only, no row content', async () => {
    insertVisit(sqlite, 'not-a-date')
    insertVisit(sqlite, '2026-05-01T07:30:00.000Z')

    await run()

    const logged = [...logger.info.mock.calls, ...logger.warn.mock.calls].flat().join(' ')
    expect(logged).not.toContain('not-a-date')
    expect(logged).not.toContain('2026-05-01')
    expect(logged.length).toBeGreaterThan(0)
  })

  it('DST: 2026-03-29T01:30:00Z becomes 03:30:00 local (after the gap)', async () => {
    expect(await convert('2026-03-29T01:30:00Z')).toBe('2026-03-29T03:30:00')
  })

  it('DST overlap: 2026-10-25T00:30:00Z and 01:30:00Z both become 02:30:00 local', async () => {
    const first = insertVisit(sqlite, '2026-10-25T00:30:00Z')
    const second = insertVisit(sqlite, '2026-10-25T01:30:00Z')

    await run()

    expect(startsAtOf(sqlite, first)).toBe('2026-10-25T02:30:00')
    expect(startsAtOf(sqlite, second)).toBe('2026-10-25T02:30:00')
  })

  it('does not touch created_at or updated_at', async () => {
    const id = insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    const select = sqlite.prepare<[number], Record<string, unknown>>(
      'SELECT * FROM frequentation WHERE id = ?'
    )
    const before = select.get(id)

    await run()

    const after = select.get(id)
    expect(after).toEqual({ ...before, starts_at: '2026-05-01T09:30:00' })
  })

  it("calls createAutomaticBackup('normalization') once, before any row changes", async () => {
    const id = insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    let startsAtAtBackup = ''
    createAutomaticBackup.mockImplementation(async () => {
      startsAtAtBackup = startsAtOf(sqlite, id)
      return BACKUP_PATH
    })

    await run()

    expect(createAutomaticBackup).toHaveBeenCalledTimes(1)
    expect(createAutomaticBackup).toHaveBeenCalledWith('normalization')
    expect(startsAtAtBackup).toBe('2026-05-01T07:30:00.000Z')
  })

  it('does not back up when nothing needs conversion', async () => {
    insertVisit(sqlite, '2026-05-01T09:30:00')

    const result = await run()

    expect(result).toEqual({ status: 'nothing-to-convert', converted: 0, unparseable: 0 })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it('sets the done flag then', async () => {
    insertVisit(sqlite, '2026-05-01T09:30:00')

    await run()

    expect(flagValue(sqlite)).toBe('true')
  })

  it("is idempotent: a second run is 'already-done', no backup, no write", async () => {
    insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    await run()
    createAutomaticBackup.mockClear()
    const legacy = insertVisit(sqlite, '2026-06-01T07:30:00.000Z')

    const result = await run()

    expect(result).toEqual({ status: 'already-done', converted: 0, unparseable: 0 })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
    expect(startsAtOf(sqlite, legacy)).toBe('2026-06-01T07:30:00.000Z')
  })

  it('backup failure throws, rows unchanged, flag not set', async () => {
    const id = insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    createAutomaticBackup.mockRejectedValue(new Error('disk full'))

    await expect(run()).rejects.toThrow('disk full')

    expect(startsAtOf(sqlite, id)).toBe('2026-05-01T07:30:00.000Z')
    expect(flagValue(sqlite)).toBeUndefined()
  })

  it('transaction atomicity: a failure while updating rolls everything back', async () => {
    const ids = [
      insertVisit(sqlite, '2026-05-01T07:30:00.000Z'),
      insertVisit(sqlite, '2026-05-02T07:30:00.000Z'),
      insertVisit(sqlite, '2026-05-03T07:30:00.000Z')
    ]
    expect(ids).toHaveLength(EXPECTED_THREE)
    sqlite.exec(
      `CREATE TRIGGER fail_third BEFORE UPDATE ON frequentation WHEN NEW.id = ${ids[THIRD_ROW_INDEX]} BEGIN SELECT RAISE(ABORT,'boom'); END`
    )

    await expect(run()).rejects.toThrow('boom')

    expect(ids.map((id) => startsAtOf(sqlite, id))).toEqual([
      '2026-05-01T07:30:00.000Z',
      '2026-05-02T07:30:00.000Z',
      '2026-05-03T07:30:00.000Z'
    ])
    expect(flagValue(sqlite)).toBeUndefined()
  })

  it('only the done flag is written when only unparseable rows exist', async () => {
    const bad = insertVisit(sqlite, 'not-a-date')

    const result = await run()

    expect(result).toEqual({ status: 'nothing-to-convert', converted: 0, unparseable: 1 })
    expect(startsAtOf(sqlite, bad)).toBe('not-a-date')
    expect(flagValue(sqlite)).toBe('true')
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it('sets the done flag to true after a run that converted rows', async () => {
    insertVisit(sqlite, '2026-05-01T07:30:00.000Z')

    await run()

    expect(flagValue(sqlite)).toBe('true')
  })

  it('only treats the flag value "true" as done', async () => {
    const id = insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    sqlite
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run(STARTS_AT_LOCAL_DONE_KEY, 'false')

    const result = await run()

    expect(result.status).toBe('converted')
    expect(startsAtOf(sqlite, id)).toBe('2026-05-01T09:30:00')
    expect(flagValue(sqlite)).toBe('true')
  })

  it('converts a timestamp without seconds', async () => {
    expect(await convert('2026-05-01T07:30Z')).toBe('2026-05-01T09:30:00')
  })

  it('converts more than three fractional digits', async () => {
    expect(await convert('2026-05-01T07:30:00.123456Z')).toBe('2026-05-01T09:30:00')
  })

  it('counts an hour-only offset (+02) as unparseable and leaves it untouched', async () => {
    const id = insertVisit(sqlite, '2026-07-10T09:30:00+02')

    const result = await run()

    expect(startsAtOf(sqlite, id)).toBe('2026-07-10T09:30:00+02')
    expect(result).toEqual({ status: 'nothing-to-convert', converted: 0, unparseable: 1 })
  })

  it.each(['2026-02-30T10:00:00Z', '2026-04-31T10:00:00Z', '2026-05-01T24:00:00Z'])(
    'treats the impossible date %s as unparseable instead of rolling it over',
    async (impossible) => {
      const id = insertVisit(sqlite, impossible)

      const result = await run()

      expect(startsAtOf(sqlite, id)).toBe(impossible)
      expect(result).toEqual({ status: 'nothing-to-convert', converted: 0, unparseable: 1 })
    }
  )

  it('does not overwrite a row that changed while the backup was being written', async () => {
    const id = insertVisit(sqlite, '2026-05-01T07:30:00.000Z')
    createAutomaticBackup.mockImplementation(async () => {
      sqlite
        .prepare('UPDATE frequentation SET starts_at = ? WHERE id = ?')
        .run('2026-05-01T11:00:00', id)
      return BACKUP_PATH
    })

    await run()

    expect(startsAtOf(sqlite, id)).toBe('2026-05-01T11:00:00')
  })
})
