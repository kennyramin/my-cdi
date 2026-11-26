import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import type { SettingGateway } from '@settings/gateways/setting'
import { backupSettings } from '../../../settings/backupSettings'
import type { BackupDialogs } from '../../../ports'
import { runManualBackup } from '../runManualBackup'

const NOW = new Date('2026-11-25T14:05:09')
const NOW_LOCAL = '2026-11-25T14:05:09'
const EXPECTED_NAME = 'mon-cdi-2026-11-25.db'

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

describe('runManualBackup', () => {
  let dir: string
  let documents: string
  let livePath: string
  let db: Database.Database
  let settings: ReturnType<typeof backupSettings>
  let proposed: string[]
  let answer: string | null

  const dialogs: BackupDialogs = {
    pickSavePath: async ({ defaultPath }) => {
      proposed.push(defaultPath)
      return answer
    },
    pickOpenPath: async () => null
  }

  function run(): ReturnType<typeof runManualBackup> {
    return runManualBackup({
      dialogs,
      sqlite: db,
      settings,
      documentsPath: documents,
      now: () => NOW
    })
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-manual-'))
    documents = join(dir, 'Documents')
    mkdirSync(documents)
    livePath = join(dir, 'live.db')
    db = new Database(livePath)
    db.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)')
    db.exec("INSERT INTO students (name) VALUES ('a')")
    settings = backupSettings(createFakeGateway())
    proposed = []
    answer = join(documents, EXPECTED_NAME)
  })

  afterEach(() => {
    if (db.open) {
      db.close()
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('proposes mon-cdi-2026-11-25.db in Documents when no folder was used', async () => {
    await run()

    expect(proposed).toEqual([join(documents, EXPECTED_NAME)])
  })

  it('proposes the last used folder', async () => {
    const other = join(dir, 'other')
    mkdirSync(other)
    await settings.setLastDirectory(other)

    await run()

    expect(proposed).toEqual([join(other, EXPECTED_NAME)])
  })

  it('cancel returns { cancelled: true } and writes nothing', async () => {
    answer = null

    const result = await run()

    expect(result).toEqual({ cancelled: true })
    expect(readdirSync(documents)).toEqual([])
  })

  it('cancel does not update lastBackupAt', async () => {
    answer = null

    await run()

    expect(await settings.getLastBackupAt()).toBeNull()
    expect(await settings.getLastDirectory()).toBeNull()
  })

  it('stores lastBackupAt as a local YYYY-MM-DDTHH:mm:ss string', async () => {
    const result = await run()

    expect(result).toEqual({ path: join(documents, EXPECTED_NAME) })
    expect(await settings.getLastBackupAt()).toBe(NOW_LOCAL)
  })

  it('remembers the chosen folder', async () => {
    const chosen = join(dir, 'chosen')
    mkdirSync(chosen)
    answer = join(chosen, 'custom.db')

    await run()

    expect(await settings.getLastDirectory()).toBe(chosen)
    expect(existsSync(answer)).toBe(true)
  })

  it('refuses the live database path', async () => {
    answer = livePath

    const error = await run().then(
      () => null,
      (e: unknown) => e
    )

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ code: ErrorCode.BACKUP_PATH_IS_LIVE_DB })
    expect(db.prepare('SELECT COUNT(*) AS n FROM students').get()).toEqual({ n: 1 })
    expect(await settings.getLastBackupAt()).toBeNull()
  })

  it('unwritable destination rejects and leaves lastBackupAt unchanged', async () => {
    await settings.setLastBackupAt('2026-01-01T00:00:00')
    answer = join(dir, 'missing-folder', 'x.db')

    await expect(run()).rejects.toMatchObject({ code: ErrorCode.BACKUP_WRITE_FAILED })

    expect(await settings.getLastBackupAt()).toBe('2026-01-01T00:00:00')
  })
})
