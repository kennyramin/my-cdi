import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import type { SettingGateway } from '@settings/gateways/setting'
import { backupSettings } from '../../../settings/backupSettings'
import type { BackupDialogs } from '../../../ports'
import { createRestoreSession } from '../restoreBackup'

const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle')

function makeValidBackup(path: string): void {
  const db = new Database(path)
  try {
    migrate(drizzle(db), { migrationsFolder: MIGRATIONS_FOLDER })
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
      migrationsFolder: MIGRATIONS_FOLDER,
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

  it('cancelling a later select discards the earlier selection', async () => {
    picked = join(dir, 'a.db')
    makeValidBackup(picked)
    await session.select()
    picked = null

    expect(await session.select()).toEqual({ cancelled: true })

    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('an invalid later select discards the earlier selection', async () => {
    picked = join(dir, 'a.db')
    makeValidBackup(picked)
    await session.select()
    picked = join(dir, 'garbage.db')
    writeFileSync(picked, 'not a database at all')

    await rejection(session.select())

    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('a confirm-time validation failure clears the selection', async () => {
    picked = join(dir, 'a.db')
    makeValidBackup(picked)
    await session.select()
    writeFileSync(picked, 'corrupted after selection')

    await rejection(session.confirm())

    expect(await rejection(session.confirm())).toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    expect(apply).not.toHaveBeenCalled()
  })

  it('a file deleted between select and confirm gives a typed error', async () => {
    picked = join(dir, 'a.db')
    makeValidBackup(picked)
    await session.select()
    rmSync(picked)

    const error = await rejection(session.confirm())

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ code: ErrorCode.RESTORE_NOT_A_DATABASE })
    expect(apply).not.toHaveBeenCalled()
  })

  it('only the latest of overlapping selects sets the selection', async () => {
    const first = join(dir, 'first.db')
    const second = join(dir, 'second.db')
    makeValidBackup(first)
    makeValidBackup(second)
    const resolvers: ((path: string) => void)[] = []
    const overlapping = createRestoreSession({
      dialogs: {
        pickSavePath: async () => null,
        pickOpenPath: () => new Promise<string>((resolve) => resolvers.push(resolve))
      },
      settings: backupSettings(createFakeGateway()),
      liveDbPath,
      migrationsFolder: MIGRATIONS_FOLDER,
      documentsPath: join(dir, 'docs'),
      apply
    })

    const firstSelect = overlapping.select()
    const secondSelect = overlapping.select()
    await vi.waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1]?.(second)
    resolvers[0]?.(first)

    expect(await secondSelect).toEqual({ fileName: 'second.db' })
    expect(await firstSelect).toEqual({ cancelled: true })
    await overlapping.confirm()
    expect(apply).toHaveBeenCalledExactlyOnceWith(second)
  })

  it('reads the migration files lazily, not at construction', async () => {
    const lazy = createRestoreSession({
      dialogs,
      settings: backupSettings(createFakeGateway()),
      liveDbPath,
      migrationsFolder: join(dir, 'missing-migrations'),
      documentsPath: join(dir, 'docs'),
      apply
    })
    picked = join(dir, 'a.db')
    makeValidBackup(picked)

    await expect(lazy.select()).rejects.toThrow()
  })
})
