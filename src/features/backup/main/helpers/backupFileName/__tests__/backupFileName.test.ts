import { describe, expect, it } from 'vitest'
import { buildAutomaticBackupName, parseAutomaticBackupName } from '../backupFileName'

const DOCUMENTED_NAME = 'auto-20261125-143007-migration.db'
const SAMPLE_ISO = '2026-11-25T14:30:07'

describe('backupFileName', () => {
  it('builds the documented name', () => {
    const date = new Date(SAMPLE_ISO)
    expect(buildAutomaticBackupName(date, 'migration')).toBe(DOCUMENTED_NAME)
  })

  it('parses it back', () => {
    expect(parseAutomaticBackupName(DOCUMENTED_NAME)).toEqual({
      date: new Date(SAMPLE_ISO),
      reason: 'migration'
    })
  })

  it.each([
    'auto-foo.db',
    'auto-20261125-143007-bogus.db',
    'auto-20261125-143007-restore.db.bak',
    'x-auto-20261125-143007-restore.db',
    'auto-20261325-143007-restore.db'
  ])('rejects non-matching name %s', (name) => {
    expect(parseAutomaticBackupName(name)).toBeNull()
  })
})
