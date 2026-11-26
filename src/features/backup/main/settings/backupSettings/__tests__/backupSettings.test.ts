import { describe, expect, it } from 'vitest'
import type { SettingGateway } from '@settings/gateways/setting'
import { backupSettings } from '../backupSettings'

const LAST_BACKUP_AT_KEY = 'backup.lastBackupAt'
const LAST_DIRECTORY_KEY = 'backup.lastDirectory'

function createFakeGateway(): SettingGateway & { rows: Map<string, string> } {
  const rows = new Map<string, string>()
  return {
    rows,
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

describe('backupSettings', () => {
  it('returns null when never set', async () => {
    const settings = backupSettings(createFakeGateway())

    expect(await settings.getLastBackupAt()).toBeNull()
    expect(await settings.getLastDirectory()).toBeNull()
  })

  it('creates then updates the key', async () => {
    const settings = backupSettings(createFakeGateway())

    await settings.setLastBackupAt('2026-11-25T10:00:00')
    expect(await settings.getLastBackupAt()).toBe('2026-11-25T10:00:00')

    await settings.setLastBackupAt('2026-11-26T11:00:00')
    expect(await settings.getLastBackupAt()).toBe('2026-11-26T11:00:00')

    await settings.setLastDirectory('/a')
    await settings.setLastDirectory('/b')
    expect(await settings.getLastDirectory()).toBe('/b')
  })

  it('keys are backup.lastBackupAt and backup.lastDirectory', async () => {
    const gateway = createFakeGateway()
    const settings = backupSettings(gateway)

    await settings.setLastBackupAt('x')
    await settings.setLastDirectory('y')

    expect(gateway.rows.get(LAST_BACKUP_AT_KEY)).toBe('x')
    expect(gateway.rows.get(LAST_DIRECTORY_KEY)).toBe('y')
  })
})
