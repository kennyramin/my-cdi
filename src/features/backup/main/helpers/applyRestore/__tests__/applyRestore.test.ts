import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError, ErrorCode } from '@lib/errors'
import { createBackup } from '../../../use-cases/createBackup'
import type { FileOps } from '../../../ports'
import { nodeFileOps } from '../../nodeFileOps'
import { applyRestore } from '../applyRestore'

const LIVE_MARKER = 'live-marker'
const SOURCE_MARKER = 'source-marker'
const PARTIAL_BYTES = 'partial'
const JUNK = 'junk'
const FIRST_CALL = 0

function createDb(path: string, marker: string): void {
  const db = new Database(path)
  try {
    db.exec('CREATE TABLE marker (value TEXT)')
    db.prepare('INSERT INTO marker (value) VALUES (?)').run(marker)
  } finally {
    db.close()
  }
}

function readMarker(path: string): string {
  const db = new Database(path, { readonly: true })
  try {
    const row = db.prepare('SELECT value FROM marker').get() as { value: string }
    return row.value
  } finally {
    db.close()
  }
}

function failingRename(error: Error): FileOps['rename'] {
  return async () => {
    throw error
  }
}

async function expectRestoreFailed(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e
  )
  if (!(error instanceof AppError)) {
    throw new Error('expected an AppError')
  }
  expect(error.code).toBe(ErrorCode.RESTORE_FAILED)
  return error
}

describe('applyRestore', () => {
  let dir: string
  let livePath: string
  let sourcePath: string
  let safetyPath: string
  let closeDatabase: ReturnType<typeof vi.fn<() => void>>
  let relaunch: ReturnType<typeof vi.fn<() => void>>
  let createSafetyBackup: ReturnType<typeof vi.fn<() => Promise<string>>>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'apply-restore-'))
    livePath = join(dir, 'live.db')
    sourcePath = join(dir, 'source.db')
    safetyPath = join(dir, 'safety.db')
    createDb(livePath, LIVE_MARKER)
    createDb(sourcePath, SOURCE_MARKER)
    closeDatabase = vi.fn<() => void>()
    relaunch = vi.fn<() => void>()
    createSafetyBackup = vi.fn<() => Promise<string>>(async () => {
      const live = new Database(livePath, { readonly: true })
      try {
        await createBackup(live, safetyPath)
      } finally {
        live.close()
      }
      return safetyPath
    })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function leftoverTemps(): string[] {
    return readdirSync(dir).filter((n) => n.endsWith('-tmp'))
  }

  function run(files: FileOps = nodeFileOps, source = sourcePath): Promise<void> {
    return applyRestore({
      sourcePath: source,
      liveDbPath: livePath,
      createSafetyBackup,
      closeDatabase,
      files,
      lifecycle: { relaunch }
    })
  }

  it('replaces the live database with the source and relaunches', async () => {
    const copySpy = vi.fn(nodeFileOps.copyFile)
    const renameSpy = vi.fn(nodeFileOps.rename)
    const rmSpy = vi.fn(nodeFileOps.rm)
    const spyFiles: FileOps = { copyFile: copySpy, rename: renameSpy, rm: rmSpy }

    await run(spyFiles)

    expect(readMarker(livePath)).toBe(SOURCE_MARKER)
    expect(relaunch).toHaveBeenCalledTimes(1)
    const closeOrder = closeDatabase.mock.invocationCallOrder[FIRST_CALL]
    const firstFileOrder = Math.min(
      ...copySpy.mock.invocationCallOrder,
      ...renameSpy.mock.invocationCallOrder,
      ...rmSpy.mock.invocationCallOrder
    )
    expect(closeOrder).toBeLessThan(firstFileOrder)
  })

  it('deletes stale -wal and -shm files', async () => {
    writeFileSync(`${livePath}-wal`, JUNK)
    writeFileSync(`${livePath}-shm`, JUNK)

    await run()

    expect(existsSync(`${livePath}-wal`)).toBe(false)
    expect(existsSync(`${livePath}-shm`)).toBe(false)
  })

  it('leaves no .restore-tmp file behind', async () => {
    await run()

    expect(readdirSync(dir).filter((name) => name.endsWith('.restore-tmp'))).toEqual([])
  })

  it('restores from a path with accents and apostrophes', async () => {
    const folder = join(dir, "Sauvegardes d'été")
    mkdirSync(folder)
    const accented = join(folder, "classe à l'école.db")
    createDb(accented, SOURCE_MARKER)

    await run(nodeFileOps, accented)

    expect(readMarker(livePath)).toBe(SOURCE_MARKER)
  })

  it('aborts without touching anything when the safety backup fails', async () => {
    const failure = new Error('disk full')
    createSafetyBackup.mockRejectedValueOnce(failure)

    await expect(run()).rejects.toBe(failure)

    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(closeDatabase).not.toHaveBeenCalled()
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('rolls back to the safety copy when the replace fails after damaging live', async () => {
    const copySpy = vi.fn(nodeFileOps.copyFile)
    const files: FileOps = {
      ...nodeFileOps,
      copyFile: copySpy,
      rename: async (from, to) => {
        if (to === livePath && from.endsWith('.restore-tmp')) {
          writeFileSync(livePath, JUNK)
          throw new Error('rename denied')
        }
        return nodeFileOps.rename(from, to)
      }
    }
    writeFileSync(`${livePath}-wal`, JUNK)

    const error = await expectRestoreFailed(run(files))

    expect(error.message).toContain('rename denied')
    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(copySpy).toHaveBeenCalledWith(safetyPath, `${livePath}.rollback-tmp`)
    expect(existsSync(`${livePath}-wal`)).toBe(false)
    expect(existsSync(`${livePath}-shm`)).toBe(false)
    expect(relaunch).toHaveBeenCalledTimes(1)
    expect(leftoverTemps()).toEqual([])
  })

  it('rolls back when removing a sidecar fails', async () => {
    let failed = false
    const files: FileOps = {
      ...nodeFileOps,
      rm: async (path, options) => {
        if (path.endsWith('-shm') && !failed) {
          failed = true
          writeFileSync(livePath, JUNK)
          throw new Error('rm denied')
        }
        return nodeFileOps.rm(path, options)
      }
    }

    await expectRestoreFailed(run(files))

    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(relaunch).toHaveBeenCalledTimes(1)
    expect(leftoverTemps()).toEqual([])
  })

  it('skips the rollback copy when copying the source fails midway', async () => {
    const copySpy = vi.fn<FileOps['copyFile']>(async (src, dest) => {
      if (dest.endsWith('.restore-tmp')) {
        writeFileSync(dest, PARTIAL_BYTES)
        throw new Error('copy interrupted')
      }
      return nodeFileOps.copyFile(src, dest)
    })
    writeFileSync(`${livePath}-wal`, JUNK)

    await expectRestoreFailed(run({ ...nodeFileOps, copyFile: copySpy }))

    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(copySpy).toHaveBeenCalledTimes(1)
    expect(existsSync(`${livePath}-wal`)).toBe(true)
    expect(relaunch).toHaveBeenCalledTimes(1)
    expect(leftoverTemps()).toEqual([])
  })

  it('leaves live intact and relaunches when closing the database fails', async () => {
    closeDatabase.mockImplementation(() => {
      throw new Error('close failed')
    })
    const copySpy = vi.fn(nodeFileOps.copyFile)

    await expectRestoreFailed(run({ ...nodeFileOps, copyFile: copySpy }))

    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(copySpy).not.toHaveBeenCalled()
    expect(relaunch).toHaveBeenCalledTimes(1)
  })

  it('does not truncate live when the rollback copy fails', async () => {
    const files: FileOps = {
      ...nodeFileOps,
      rename: failingRename(new Error('rename denied')),
      copyFile: async (src, dest) => {
        if (src === safetyPath) {
          writeFileSync(dest, PARTIAL_BYTES)
          throw new Error('rollback copy denied')
        }
        return nodeFileOps.copyFile(src, dest)
      }
    }

    const error = await expectRestoreFailed(run(files))

    expect(error.message).toContain(safetyPath)
    expect(readMarker(livePath)).toBe(LIVE_MARKER)
    expect(relaunch).toHaveBeenCalledTimes(1)
    expect(leftoverTemps()).toEqual([])
  })

  it('still reports RESTORE_FAILED when relaunch throws', async () => {
    relaunch.mockImplementation(() => {
      throw new Error('relaunch failed')
    })

    await expectRestoreFailed(run({ ...nodeFileOps, rename: failingRename(new Error('nope')) }))
  })

  it('the safety backup contains the pre-restore data', async () => {
    await run()

    expect(readMarker(livePath)).toBe(SOURCE_MARKER)
    expect(readMarker(safetyPath)).toBe(LIVE_MARKER)
  })
})
