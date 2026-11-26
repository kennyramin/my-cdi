import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveDialogReturnValue } from 'electron'
import { ErrorCode } from '@lib/errors'
import {
  createElectronExportFileAdapter,
  type ExportDialog,
  type ExportFs,
  nodeExportFs,
  type ExportWriteStream
} from '../electronExportFileAdapter'

class FakeStream extends EventEmitter implements ExportWriteStream {
  chunks: string[] = []
  ended = false
  destroyed = false
  closed = false
  destroyCalls = 0
  backpressureOnce = false
  write(chunk: string): boolean {
    this.chunks.push(chunk)
    if (this.backpressureOnce) {
      this.backpressureOnce = false
      return false
    }
    return true
  }
  end(): void {
    this.ended = true
    setImmediate(() => {
      this.emit('finish')
      this.closed = true
      this.emit('close')
    })
  }
  destroy(): void {
    this.destroyed = true
    this.destroyCalls += 1
    setImmediate(() => {
      this.closed = true
      this.emit('close')
    })
  }
}

const errorWithCode = (code: string): Error => Object.assign(new Error(code), { code })
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

interface Harness {
  stream: FakeStream
  fs: ExportFs
  rename: ReturnType<typeof vi.fn<ExportFs['rename']>>
  rm: ReturnType<typeof vi.fn<ExportFs['rm']>>
  openedPaths: string[]
}

function createHarness(options: { openError?: boolean | Error } = {}): Harness {
  const stream = new FakeStream()
  const openedPaths: string[] = []
  const renameFn = vi.fn<ExportFs['rename']>(async () => {
    if (!stream.closed) {
      throw new Error('rename called before the stream was closed')
    }
  })
  const rmFn = vi.fn<ExportFs['rm']>().mockResolvedValue(undefined)
  const fs: ExportFs = {
    createWriteStream: (path) => {
      openedPaths.push(path)
      setImmediate(() =>
        options.openError
          ? stream.emit(
              'error',
              options.openError instanceof Error ? options.openError : new Error('EACCES')
            )
          : stream.emit('open')
      )
      return stream
    },
    rename: renameFn,
    rm: rmFn
  }
  return { stream, fs, rename: renameFn, rm: rmFn, openedPaths }
}

const DEFAULT_DIR = '/docs'
const PERMISSION_BITS = 0o777
const PRIVATE_MODE = 0o600

function createDialog(result: SaveDialogReturnValue) {
  const showSaveDialog = vi.fn<ExportDialog['showSaveDialog']>().mockResolvedValue(result)
  return { dialog: { showSaveDialog } satisfies ExportDialog, showSaveDialog }
}

function build(
  harness: Harness,
  result: SaveDialogReturnValue = { canceled: false, filePath: '/docs/out.csv' }
) {
  const { dialog, showSaveDialog } = createDialog(result)
  const logger = { warn: vi.fn<(message: string) => void>() }
  const adapter = createElectronExportFileAdapter({
    dialog,
    fs: harness.fs,
    getParentWindow: () => null,
    getDefaultDirectory: () => DEFAULT_DIR,
    logger
  })
  return { adapter, showSaveDialog, logger }
}

describe('createElectronExportFileAdapter', () => {
  it('cancelled dialog returns null and never touches fs', async () => {
    const harness = createHarness()
    const { adapter } = build(harness, { canceled: true, filePath: '' })

    await expect(adapter.pickSavePath('a.csv')).resolves.toBeNull()

    expect(harness.openedPaths).toEqual([])
    expect(harness.rename).not.toHaveBeenCalled()
    expect(harness.rm).not.toHaveBeenCalled()
  })

  it('passes defaultPath inside the default directory and a csv filter', async () => {
    const { adapter, showSaveDialog } = build(createHarness())

    await expect(adapter.pickSavePath('mon-cdi.csv')).resolves.toBe('/docs/out.csv')

    expect(showSaveDialog).toHaveBeenCalledWith(null, {
      title: 'Exporter en CSV',
      defaultPath: join(DEFAULT_DIR, 'mon-cdi.csv'),
      filters: [{ name: 'Fichier CSV', extensions: ['csv'] }]
    })
  })

  it('writes to a .tmp file and renames on commit', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)

    const writer = await adapter.openWriter('/docs/out.csv')
    await writer.write('a')
    await writer.write('b')
    expect(harness.rename).not.toHaveBeenCalled()
    await writer.commit()

    expect(harness.openedPaths).toHaveLength(1)
    const [tempPath] = harness.openedPaths
    expect(dirname(tempPath ?? '')).toBe(dirname('/docs/out.csv'))
    expect(basename(tempPath ?? '')).toMatch(/^out\.csv\.[0-9a-f]{16}\.tmp$/)
    expect(harness.stream.chunks).toEqual(['a', 'b'])
    expect(harness.stream.ended).toBe(true)
    expect(harness.rename).toHaveBeenCalledWith(tempPath, '/docs/out.csv')
  })

  it('abort removes the tmp file and leaves an existing target untouched', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)

    const writer = await adapter.openWriter('/docs/out.csv')
    await writer.write('a')
    await writer.abort()

    expect(harness.stream.destroyed).toBe(true)
    expect(harness.rm).toHaveBeenCalledWith(harness.openedPaths[0], { force: true })
    expect(harness.rename).not.toHaveBeenCalled()
  })

  it('abort is idempotent', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    await writer.abort()
    await writer.abort()

    expect(harness.stream.destroyCalls).toBe(1)
    expect(harness.rm).toHaveBeenCalledTimes(1)
  })

  it('abort after a failed commit removes the tmp file', async () => {
    const harness = createHarness()
    harness.rename.mockRejectedValue(new Error('EBUSY'))
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    await expect(writer.commit()).rejects.toBeDefined()

    await writer.abort()

    expect(harness.rm).toHaveBeenCalledWith(harness.openedPaths[0], { force: true })
  })

  it('a failed open leaves no handle nor temp file', async () => {
    const harness = createHarness({ openError: true })
    const { adapter } = build(harness)

    await expect(adapter.openWriter('/docs/out.csv')).rejects.toBeDefined()

    expect(harness.stream.destroyed).toBe(true)
    expect(harness.rm).toHaveBeenCalledWith(harness.openedPaths[0], { force: true })
  })

  it('abort never throws even when removal fails', async () => {
    const harness = createHarness()
    harness.rm.mockRejectedValue(new Error('EBUSY'))
    const { adapter } = build(harness)

    const writer = await adapter.openWriter('/docs/out.csv')

    await expect(writer.abort()).resolves.toBeUndefined()
  })

  it('awaits drain when the stream reports backpressure', async () => {
    const harness = createHarness()
    harness.stream.backpressureOnce = true
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    let settled = false
    const pending = writer.write('big').then(() => {
      settled = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)

    harness.stream.emit('drain')
    await pending
    expect(settled).toBe(true)
  })

  it('stream error on open rejects with EXPORT_WRITE_FAILED', async () => {
    const { adapter } = build(createHarness({ openError: true }))

    await expect(adapter.openWriter('/docs/out.csv')).rejects.toMatchObject({
      code: ErrorCode.EXPORT_WRITE_FAILED
    })
  })

  it('a stream error during writing rejects the next write', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    harness.stream.emit('error', new Error('ENOSPC'))

    await expect(writer.write('x')).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })
  })

  it('a failing rename rejects commit with EXPORT_WRITE_FAILED', async () => {
    const harness = createHarness()
    harness.rename.mockRejectedValue(new Error('EPERM'))
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })
  })
})

describe('createElectronExportFileAdapter failure handling', () => {
  it('renames only after the stream emitted close', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    await writer.write('a')

    await writer.commit()

    expect(harness.rename).toHaveBeenCalledTimes(1)
    expect(harness.stream.closed).toBe(true)
  })

  it('a stream error while awaiting drain rejects the pending write', async () => {
    const harness = createHarness()
    harness.stream.backpressureOnce = true
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    const pending = writer.write('big')
    await tick()
    harness.stream.emit('error', errorWithCode('ENOSPC'))

    await expect(pending).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })
  })

  it('an error while flushing in commit rejects and never renames', async () => {
    const harness = createHarness()
    harness.stream.end = () => {
      setImmediate(() => harness.stream.emit('error', errorWithCode('ENOSPC')))
    }
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')

    await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })

    expect(harness.rename).not.toHaveBeenCalled()
  })

  it('abort after a failed write destroys the stream and removes the temp file', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    harness.stream.emit('error', errorWithCode('ENOSPC'))
    await expect(writer.write('x')).rejects.toBeDefined()

    await writer.abort()

    expect(harness.stream.destroyed).toBe(true)
    expect(harness.rm).toHaveBeenCalledWith(harness.openedPaths[0], { force: true })
  })

  it('a second commit after success does not hang nor rename again', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    await writer.commit()

    await writer.commit()

    expect(harness.rename).toHaveBeenCalledTimes(1)
  })

  it('commit after abort rejects without hanging', async () => {
    const harness = createHarness()
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    await writer.abort()

    await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(harness.rename).not.toHaveBeenCalled()
  })

  it('commit retried after a failed rename does not hang', async () => {
    const harness = createHarness()
    harness.rename.mockRejectedValueOnce(errorWithCode('EBUSY'))
    const { adapter } = build(harness)
    const writer = await adapter.openWriter('/docs/out.csv')
    await expect(writer.commit()).rejects.toBeDefined()

    await expect(writer.commit()).resolves.toBeUndefined()
  })

  it.each(['EBUSY', 'EPERM'])(
    'rename failing with %s maps to EXPORT_FILE_LOCKED and is logged',
    async (code) => {
      const harness = createHarness()
      harness.rename.mockRejectedValue(errorWithCode(code))
      const { adapter, logger } = build(harness)
      const writer = await adapter.openWriter('/docs/out.csv')

      await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_FILE_LOCKED })

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(code))
    }
  )

  it('other rename failures map to EXPORT_WRITE_FAILED and log the code only', async () => {
    const harness = createHarness()
    harness.rename.mockRejectedValue(errorWithCode('ENOENT'))
    const { adapter, logger } = build(harness)
    const writer = await adapter.openWriter('/docs/secret-name.csv')

    await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ENOENT'))
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('secret-name'))
  })

  it('open failing with EBUSY maps to EXPORT_FILE_LOCKED', async () => {
    const harness = createHarness({ openError: errorWithCode('EBUSY') })
    const { adapter } = build(harness)

    await expect(adapter.openWriter('/docs/out.csv')).rejects.toMatchObject({
      code: ErrorCode.EXPORT_FILE_LOCKED
    })
  })
})

describe('createElectronExportFileAdapter with the real file system', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'export-adapter-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const realAdapter = () =>
    createElectronExportFileAdapter({
      dialog: { showSaveDialog: vi.fn<ExportDialog['showSaveDialog']>() },
      fs: nodeExportFs,
      getParentWindow: () => null,
      getDefaultDirectory: () => dir,
      logger: { warn: vi.fn() }
    })

  it('writing into a non-existent directory rejects and leaves no file', async () => {
    const missing = join(dir, 'missing', 'out.csv')

    await expect(realAdapter().openWriter(missing)).rejects.toMatchObject({
      code: ErrorCode.EXPORT_WRITE_FAILED
    })

    expect(await readdir(dir)).toEqual([])
  })

  it('commit replaces the target and leaves no tmp file', async () => {
    const target = join(dir, 'out.csv')
    await writeFile(target, 'old')

    const writer = await realAdapter().openWriter(target)
    await writer.write('new,')
    await writer.write('data')
    await writer.commit()

    expect(await readFile(target, 'utf8')).toBe('new,data')
    expect(await readdir(dir)).toEqual(['out.csv'])
  })

  it('abort leaves an existing target untouched and removes the tmp file', async () => {
    const target = join(dir, 'out.csv')
    await writeFile(target, 'old')

    const writer = await realAdapter().openWriter(target)
    await writer.write('partial')
    await writer.abort()

    expect(await readFile(target, 'utf8')).toBe('old')
    expect(await readdir(dir)).toEqual(['out.csv'])
  })

  it('a failed rename (target is a directory) leaves it untouched; abort then removes the tmp file twice-safely', async () => {
    const target = join(dir, 'out.csv')
    await mkdir(target)
    await writeFile(join(target, 'keep.txt'), 'keep')

    const writer = await realAdapter().openWriter(target)
    await writer.write('data')
    expect(await readdir(dir)).toHaveLength(2)
    await expect(writer.commit()).rejects.toMatchObject({ code: ErrorCode.EXPORT_WRITE_FAILED })
    await writer.abort()
    await writer.abort()

    expect(await readdir(dir)).toEqual(['out.csv'])
    expect(await readdir(target)).toEqual(['keep.txt'])
  })

  it('the temp file is a sibling of the target with an unpredictable name', async () => {
    const target = join(dir, 'out.csv')
    const first = await realAdapter().openWriter(target)
    const second = await realAdapter().openWriter(target)

    const names = (await readdir(dir)).sort()
    expect(names).toHaveLength(2)
    expect(names.every((name) => name !== 'out.csv' && name.endsWith('.tmp'))).toBe(true)
    expect(new Set(names).size).toBe(2)
    await first.abort()
    await second.abort()
    expect(await readdir(dir)).toEqual([])
  })

  it('nodeExportFs refuses to open an existing temp name (wx) and keeps it intact', async () => {
    const existing = join(dir, 'taken.tmp')
    await writeFile(existing, 'mine')
    const stream = nodeExportFs.createWriteStream(existing)

    const error = await new Promise<unknown>((resolve) => stream.once('error', resolve))

    expect(error).toMatchObject({ code: 'EEXIST' })
    expect(await readFile(existing, 'utf8')).toBe('mine')
  })

  it('creates the temp file private (0o600) and the committed target keeps that mode', async () => {
    if (process.platform === 'win32') {
      return
    }
    const target = join(dir, 'out.csv')
    const writer = await realAdapter().openWriter(target)
    await writer.write('x')
    await writer.commit()

    expect((await stat(target)).mode & PERMISSION_BITS).toBe(PRIVATE_MODE)
  })
})
