import { EventEmitter } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveDialogReturnValue } from 'electron'
import { ErrorCode } from '@lib/errors'
import {
  createElectronExportFileAdapter,
  type ExportDialog,
  type ExportFs,
  type ExportWriteStream
} from '../electronExportFileAdapter'

class FakeStream extends EventEmitter implements ExportWriteStream {
  chunks: string[] = []
  ended = false
  destroyed = false
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
      this.emit('close')
    })
  }
  destroy(): void {
    this.destroyed = true
    this.destroyCalls += 1
    setImmediate(() => this.emit('close'))
  }
}

interface Harness {
  stream: FakeStream
  fs: ExportFs
  rename: ReturnType<typeof vi.fn<ExportFs['rename']>>
  rm: ReturnType<typeof vi.fn<ExportFs['rm']>>
  openedPaths: string[]
}

function createHarness(options: { openError?: boolean } = {}): Harness {
  const stream = new FakeStream()
  const openedPaths: string[] = []
  const renameFn = vi.fn<ExportFs['rename']>().mockResolvedValue(undefined)
  const rmFn = vi.fn<ExportFs['rm']>().mockResolvedValue(undefined)
  const fs: ExportFs = {
    createWriteStream: (path) => {
      openedPaths.push(path)
      setImmediate(() =>
        options.openError ? stream.emit('error', new Error('EACCES')) : stream.emit('open')
      )
      return stream
    },
    rename: renameFn,
    rm: rmFn
  }
  return { stream, fs, rename: renameFn, rm: rmFn, openedPaths }
}

const DEFAULT_DIR = '/docs'

function createDialog(result: SaveDialogReturnValue) {
  const showSaveDialog = vi.fn<ExportDialog['showSaveDialog']>().mockResolvedValue(result)
  return { dialog: { showSaveDialog } satisfies ExportDialog, showSaveDialog }
}

function build(
  harness: Harness,
  result: SaveDialogReturnValue = { canceled: false, filePath: '/docs/out.csv' }
) {
  const { dialog, showSaveDialog } = createDialog(result)
  const adapter = createElectronExportFileAdapter({
    dialog,
    fs: harness.fs,
    getParentWindow: () => null,
    getDefaultDirectory: () => DEFAULT_DIR
  })
  return { adapter, showSaveDialog }
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
    expect(tempPath).toMatch(/^\/docs\/out\.csv\.[0-9a-f]{16}\.tmp$/)
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
      fs: {
        createWriteStream: (path) => createWriteStream(path, { flags: 'wx' }),
        rename,
        rm
      },
      getParentWindow: () => null,
      getDefaultDirectory: () => dir
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
})
