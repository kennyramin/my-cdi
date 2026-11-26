import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listAutomaticBackups } from '../listAutomaticBackups'

describe('listAutomaticBackups', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-list-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('sorts newest first', async () => {
    writeFileSync(join(dir, 'auto-20260101-000000-restore.db'), '')
    writeFileSync(join(dir, 'auto-20261125-143007-migration.db'), '')
    writeFileSync(join(dir, 'auto-20260601-120000-anonymization.db'), '')

    const names = (await listAutomaticBackups(dir)).map((file) => file.name)

    expect(names).toEqual([
      'auto-20261125-143007-migration.db',
      'auto-20260601-120000-anonymization.db',
      'auto-20260101-000000-restore.db'
    ])
  })

  it('returns regular matching files only', async () => {
    writeFileSync(join(dir, 'notes.txt'), '')
    mkdirSync(join(dir, 'auto-20200101-000000-restore.db'))

    expect(await listAutomaticBackups(dir)).toEqual([])
  })

  it('returns [] when the folder does not exist', async () => {
    expect(await listAutomaticBackups(join(dir, 'missing'))).toEqual([])
  })
})
