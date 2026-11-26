import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SettingGateway } from '@settings/gateways/setting'
import { backupSettings } from '../../../settings/backupSettings'
import { configureBackupRuntime } from '../../../runtime'
import { createAutomaticBackup } from '../../createAutomaticBackup'
import { getBackupStatus } from '../getBackupStatus'

const NOW = new Date('2026-11-25T09:00:00')

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

describe('getBackupStatus', () => {
  let dir: string
  let backupsDir: string
  let db: Database.Database
  let settings: ReturnType<typeof backupSettings>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-status-'))
    backupsDir = join(dir, 'backups')
    db = new Database(join(dir, 'live.db'))
    db.exec('CREATE TABLE students (id INTEGER PRIMARY KEY)')
    settings = backupSettings(createFakeGateway())
    configureBackupRuntime({ getSqlite: () => db, backupsDir, now: () => NOW })
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('counts only auto-*.db files', async () => {
    await createAutomaticBackup('migration')
    writeFileSync(join(backupsDir, 'mon-cdi-2026-11-25.db'), 'x')
    writeFileSync(join(backupsDir, 'notes.txt'), 'x')

    const status = await getBackupStatus({ settings, backupsDir })

    expect(status.automaticCount).toBe(1)
  })

  it('returns lastBackupAt null when never backed up', async () => {
    const status = await getBackupStatus({ settings, backupsDir })

    expect(status).toEqual({ lastBackupAt: null, automaticCount: 0 })
  })

  it('automatic backups do not change lastBackupAt', async () => {
    await settings.setLastBackupAt('2026-11-20T08:00:00')
    const before = await getBackupStatus({ settings, backupsDir })

    await createAutomaticBackup('restore')
    const after = await getBackupStatus({ settings, backupsDir })

    expect(after.lastBackupAt).toBe(before.lastBackupAt)
    expect(after.automaticCount).toBe(before.automaticCount + 1)
  })
})
