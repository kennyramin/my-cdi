import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listAutomaticBackups } from '../../listAutomaticBackups'
import { deleteAutomaticBackups } from '../deleteAutomaticBackups'

vi.mock('../../listAutomaticBackups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../listAutomaticBackups')>()
  return { ...actual, listAutomaticBackups: vi.fn(actual.listAutomaticBackups) }
})

describe('deleteAutomaticBackups', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'my-cdi-delete-'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('deletes only auto-*.db files and reports the count', async () => {
    writeFileSync(join(dir, 'auto-20261125-143007-migration.db'), '')
    writeFileSync(join(dir, 'auto-20261124-143007-restore.db'), '')
    writeFileSync(join(dir, 'manual.db'), '')

    expect(await deleteAutomaticBackups(dir)).toEqual({ deleted: 2 })
    expect(existsSync(join(dir, 'auto-20261125-143007-migration.db'))).toBe(false)
    expect(existsSync(join(dir, 'manual.db'))).toBe(true)
  })

  it('leaves unrelated files and directories', async () => {
    mkdirSync(join(dir, 'auto-20200101-000000-restore.db'))
    writeFileSync(join(dir, 'notes.txt'), '')
    writeFileSync(join(dir, 'auto-foo.db'), '')

    expect(await deleteAutomaticBackups(dir)).toEqual({ deleted: 0 })
    expect(existsSync(join(dir, 'auto-20200101-000000-restore.db'))).toBe(true)
    expect(existsSync(join(dir, 'notes.txt'))).toBe(true)
    expect(existsSync(join(dir, 'auto-foo.db'))).toBe(true)
  })

  it('returns 0 when the folder does not exist', async () => {
    expect(await deleteAutomaticBackups(join(dir, 'missing'))).toEqual({ deleted: 0 })
  })

  it('continues past an entry that cannot be removed and counts only removed ones', async () => {
    // rm without `recursive` rejects on a directory, standing in for EPERM/EBUSY
    const stuck = join(dir, 'auto-20261125-143007-migration.db')
    const removable = join(dir, 'auto-20261124-143007-restore.db')
    mkdirSync(join(stuck, 'child'), { recursive: true })
    writeFileSync(removable, '')
    vi.mocked(listAutomaticBackups).mockResolvedValueOnce([
      { name: 'stuck', path: stuck, date: new Date(2) },
      { name: 'removable', path: removable, date: new Date(1) }
    ])

    const result = await deleteAutomaticBackups(dir)

    expect(result).toEqual({ deleted: 1 })
    expect(existsSync(stuck)).toBe(true)
    expect(existsSync(removable)).toBe(false)
  })
})
