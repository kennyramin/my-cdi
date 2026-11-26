import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import type { BrowserWindow, SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import { AppError, ErrorCode } from '@lib/errors'
import type { ExportFileAdapter, ExportWriter } from '../../ports'

const DIALOG_TITLE = 'Exporter en CSV'
const FILTER_NAME = 'Fichier CSV'
const CSV_EXTENSION = 'csv'
const TEMP_SUFFIX = '.tmp'
const TEMP_TOKEN_BYTES = 8
const WRITE_FAILED_MESSAGE = 'Export file could not be written'

type StreamListener = (error?: Error) => void

export interface ExportWriteStream {
  write(chunk: string): boolean
  end(): void
  destroy(): void
  once(event: string, listener: StreamListener): unknown
}

export interface ExportFs {
  /** Must refuse to open (error event) a file that already exists. */
  createWriteStream(path: string): ExportWriteStream
  rename(from: string, to: string): Promise<void>
  rm(path: string, options: { force: true }): Promise<void>
}

export interface ExportDialog {
  showSaveDialog(
    parent: BrowserWindow | null,
    options: SaveDialogOptions
  ): Promise<SaveDialogReturnValue>
}

export interface ElectronExportFileAdapterDeps {
  dialog: ExportDialog
  fs: ExportFs
  getParentWindow: () => BrowserWindow | null
  getDefaultDirectory: () => string
}

const writeFailed = (): AppError =>
  new AppError(ErrorCode.EXPORT_WRITE_FAILED, WRITE_FAILED_MESSAGE)

const buildTempPath = (path: string): string =>
  `${path}.${randomBytes(TEMP_TOKEN_BYTES).toString('hex')}${TEMP_SUFFIX}`

async function openStream(fs: ExportFs, tempPath: string): Promise<ExportWriteStream> {
  let stream: ExportWriteStream | undefined
  try {
    return await new Promise<ExportWriteStream>((resolve, reject) => {
      const opened = fs.createWriteStream(tempPath)
      stream = opened
      opened.once('error', () => reject(writeFailed()))
      opened.once('open', () => resolve(opened))
    })
  } catch {
    // runExport never aborts a writer that failed to open: leave no handle nor temp file behind
    try {
      stream?.destroy()
      await fs.rm(tempPath, { force: true })
    } catch {
      // nothing more can be done
    }
    throw writeFailed()
  }
}

function createWriter(
  fs: ExportFs,
  stream: ExportWriteStream,
  path: string,
  tempPath: string
): ExportWriter {
  let aborted = false
  let failed = false
  let closed = false
  const closedSignal = new Promise<void>((resolve) => {
    stream.once('close', () => {
      closed = true
      resolve()
    })
  })
  let rejectPending: ((error: AppError) => void) | null = null
  stream.once('error', () => {
    failed = true
    rejectPending?.(writeFailed())
  })

  const waitFor = (event: string): Promise<void> =>
    new Promise((resolve, reject) => {
      rejectPending = reject
      stream.once(event, () => {
        rejectPending = null
        resolve()
      })
    })

  return {
    async write(chunk) {
      if (failed) {
        throw writeFailed()
      }
      if (!stream.write(chunk)) {
        await waitFor('drain')
      }
    },
    async commit() {
      if (failed) {
        throw writeFailed()
      }
      // the handle must be flushed and closed before the rename (Windows refuses otherwise)
      const closedAfterEnd = waitFor('close')
      stream.end()
      await closedAfterEnd
      try {
        await fs.rename(tempPath, path)
      } catch {
        throw writeFailed()
      }
    },
    async abort() {
      if (aborted) {
        return
      }
      aborted = true
      try {
        stream.destroy()
        if (!closed) {
          await closedSignal
        }
        await fs.rm(tempPath, { force: true })
      } catch {
        // abort never throws: the caller is already reporting the original failure
      }
    }
  }
}

/**
 * Contract: the temp file lives next to the chosen path (same filesystem) under an unpredictable
 * name and is never the final name; nothing is ever written outside the chosen path. A failing
 * openWriter leaves no handle or temp file. commit() flushes and closes the handle before the
 * rename, and an existing target stays untouched until the rename succeeds. abort() works after a
 * failed write or a failed commit, closes the handle, removes the temp file, never throws and is
 * idempotent.
 */
export function createElectronExportFileAdapter(
  deps: ElectronExportFileAdapterDeps
): ExportFileAdapter {
  const { dialog, fs, getParentWindow, getDefaultDirectory } = deps
  return {
    async pickSavePath(defaultFileName) {
      const result = await dialog.showSaveDialog(getParentWindow(), {
        title: DIALOG_TITLE,
        defaultPath: join(getDefaultDirectory(), defaultFileName),
        filters: [{ name: FILTER_NAME, extensions: [CSV_EXTENSION] }]
      })
      if (result.canceled || !result.filePath) {
        return null
      }
      return result.filePath
    },
    async openWriter(path) {
      const tempPath = buildTempPath(path)
      const stream = await openStream(fs, tempPath)
      return createWriter(fs, stream, path, tempPath)
    }
  }
}
