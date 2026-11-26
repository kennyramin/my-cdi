import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import type { SettingGateway } from '@settings/gateways/setting'
import { backupSettings } from '../../../settings/backupSettings'
import type { BackupDialogs } from '../../../ports'
import { createRestoreSession } from '../restoreBackup'

const LATEST_MILLIS = 1_700_000_000_000

function makeValidBackup(path: string): void {
  const db = new Database(path)
  try {
    db.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)')
    db.exec('CREATE TABLE frequentation (id INTEGER PRIMARY KEY)')
    db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, created_at NUMERIC)')
    db.prepare('INSERT INTO __drizzle_migrations (created_at) VALUES (?)').run(LATEST_MILLIS)
  } finally {
    db.close()
  }
}

function createFakeGateway(): SettingGateway {
  const rows = new Map<string, string>()
  return {
    getByKey: async (key) => {
      const value = rows.get(key)
      return value === undefined ? null : { key, value }
    },
    create: async (setting) => {
      rows.set(setting.key, setting.value)
      return setting
    },
    update: async (key, value) => {
      if (!rows.has(key)) {
        return null
      }
      rows.set(key, value)
      return { key, value }
    }
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e
  )
}

describe('createRestoreSession', () => {
  let dir: string
  let liveDbPath: string
  let picked: string | null
  let apply: ReturnType<typeof vi.fn<(sourcePath: string) => Promise<void>>>
  let session: ReturnType<typeof createRestoreSession>

  const dialogs: BackupDialogs = {
    pickSavePath: async () => null,
    pickOpenPath: async () => picked
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-restore-'))
    mkdirSync(join(dir, 'docs'))
    liveDbPath = join(dir, 'live.db')
    picked = null
    apply = vi.fn<(sourcePath: string) => Promise<void>>().mockResolvedValue(undefined)
    session = createRestoreSession({
      dialogs,
      settings: backupSettings(createFakeGateway()),
      liveDbPath,
      latestMigrationMillis: LATEST_MILLIS,
      documentsPath: join(dir, 'docs'),
      apply
    })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('select cancel returns { cancelled: true } and nothing is selected', async () => {
    const result = await session.select()

    expect(result).toEqual({ cancelled: true })
    const error = await rejection(session.confirm())
    expect(error).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('select returns the file name only', async () => {
    picked = join(dir, 'my-backup.db')
    makeValidBackup(picked)

    const result = await session.select()

    expect(result).toEqual({ fileName: 'my-backup.db' })
  })

  it('select rejects an invalid file with its typed code and keeps no selection', async () => {
    picked = join(dir, 'garbage.db')
    writeFileSync(picked, 'not a database at all')

    const error = await rejection(session.select())

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ code: ErrorCode.RESTORE_NOT_A_DATABASE })
    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('confirm without a selection is rejected', async () => {
    const error = await rejection(session.confirm())

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('confirm re-validates the selected file', async () => {
    picked = join(dir, 'b.db')
    makeValidBackup(picked)
    await session.select()
    writeFileSync(picked, 'corrupted after selection')

    const error = await rejection(session.confirm())

    expect(error).toMatchObject({ code: ErrorCode.RESTORE_NOT_A_DATABASE })
    expect(apply).not.toHaveBeenCalled()
  })

  it('confirm applies once then clears the selection', async () => {
    picked = join(dir, 'b.db')
    makeValidBackup(picked)
    await session.select()

    const result = await session.confirm()

    expect(result).toEqual({ restored: true })
    expect(apply).toHaveBeenCalledExactlyOnceWith(picked)
    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('a failed apply clears the selection', async () => {
    picked = join(dir, 'b.db')
    makeValidBackup(picked)
    apply.mockRejectedValueOnce(new AppError(ErrorCode.RESTORE_FAILED, 'boom'))
    await session.select()

    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.RESTORE_FAILED })
    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
  })

  it('a second select replaces the first', async () => {
    const first = join(dir, 'first.db')
    const second = join(dir, 'second.db')
    makeValidBackup(first)
    makeValidBackup(second)
    picked = first
    await session.select()
    picked = second
    await session.select()

    await session.confirm()

    expect(apply).toHaveBeenCalledExactlyOnceWith(second)
  })
})
