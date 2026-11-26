import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { BrowserWindow, SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import { AppError, ErrorCode } from '@lib/errors'
import type { ExportFileAdapter, ExportWriter } from '../../ports'

const DIALOG_TITLE = 'Exporter en CSV'
const FILTER_NAME = 'Fichier CSV'
const CSV_EXTENSION = 'csv'
const TEMP_SUFFIX = '.tmp'
const TEMP_TOKEN_BYTES = 8
const TEMP_FILE_MODE = 0o600
const WRITE_FAILED_MESSAGE = 'Export file could not be written'
const LOCKED_MESSAGE = 'Export file is locked by another program'
const LOCKED_ERROR_CODES: readonly string[] = ['EBUSY', 'EPERM']

type StreamListener = (error?: Error) => void

export interface ExportWriteStream {
  write(chunk: string): boolean
  end(): void
  destroy(): void
  on(event: string, listener: StreamListener): unknown
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

export interface ExportLogger {
  warn(message: string): void
}

/**
 * Real file system. 'wx' refuses to open an existing temp name (never clobbers a foreign file),
 * flush:true fsyncs before the handle closes so the rename never publishes unsynced data, and the
 * 0o600 mode keeps the (possibly personal) data private: the renamed target keeps that mode.
 */
export const nodeExportFs: ExportFs = {
  createWriteStream: (path) =>
    createWriteStream(path, { flags: 'wx', mode: TEMP_FILE_MODE, flush: true }),
  rename,
  rm
}

export interface ElectronExportFileAdapterDeps {
  dialog: ExportDialog
  fs: ExportFs
  getParentWindow: () => BrowserWindow | null
  getDefaultDirectory: () => string
  logger: ExportLogger
}

const errorCodeOf = (cause: unknown): string | undefined => {
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return typeof cause.code === 'string' ? cause.code : undefined
  }
  return undefined
}

/** Logs only the system error code (never paths or data) and maps it to an export error. */
const toExportError = (cause: unknown, logger: ExportLogger): AppError => {
  const systemCode = errorCodeOf(cause)
  logger.warn(`Export write failed (${systemCode ?? 'unknown'})`)
  if (systemCode !== undefined && LOCKED_ERROR_CODES.includes(systemCode)) {
    return new AppError(ErrorCode.EXPORT_FILE_LOCKED, LOCKED_MESSAGE)
  }
  return new AppError(ErrorCode.EXPORT_WRITE_FAILED, WRITE_FAILED_MESSAGE)
}

const buildTempPath = (path: string): string =>
  `${path}.${randomBytes(TEMP_TOKEN_BYTES).toString('hex')}${TEMP_SUFFIX}`

async function openStream(
  fs: ExportFs,
  tempPath: string,
  logger: ExportLogger
): Promise<ExportWriteStream> {
  let stream: ExportWriteStream | undefined
  try {
    return await new Promise<ExportWriteStream>((resolve, reject) => {
      const opened = fs.createWriteStream(tempPath)
      stream = opened
      opened.on('error', reject)
      opened.once('open', () => resolve(opened))
    })
  } catch (cause) {
    // runExport never aborts a writer that failed to open: leave no handle nor temp file behind
    try {
      stream?.destroy()
      await fs.rm(tempPath, { force: true })
    } catch {
      // nothing more can be done
    }
    throw toExportError(cause, logger)
  }
}

function createWriter(
  deps: { fs: ExportFs; logger: ExportLogger },
  stream: ExportWriteStream,
  path: string,
  tempPath: string
): ExportWriter {
  const { fs, logger } = deps
  let aborted = false
  let committed = false
  let closed = false
  let failure: AppError | null = null
  let rejectPending: ((error: AppError) => void) | null = null
  const closedSignal = new Promise<void>((resolve) => {
    stream.once('close', () => {
      closed = true
      resolve()
    })
  })
  // permanent handler: a late error must never become an unhandled 'error' event
  stream.on('error', (cause) => {
    failure = toExportError(cause, logger)
    rejectPending?.(failure)
  })

  const waitFor = (event: string): Promise<void> =>
    new Promise((resolve, reject) => {
      rejectPending = reject
      stream.once(event, () => {
        rejectPending = null
        resolve()
      })
    })

  const assertUsable = (): void => {
    if (aborted) {
      throw new AppError(ErrorCode.EXPORT_WRITE_FAILED, WRITE_FAILED_MESSAGE)
    }
    if (failure !== null) {
      throw failure
    }
  }

  return {
    async write(chunk) {
      assertUsable()
      if (!stream.write(chunk)) {
        await waitFor('drain')
      }
    },
    async commit() {
      if (committed) {
        return
      }
      assertUsable()
      if (!closed) {
        // the handle must be flushed and closed before the rename (Windows refuses otherwise)
        const closedAfterEnd = waitFor('close')
        stream.end()
        await closedAfterEnd
      }
      try {
        await fs.rename(tempPath, path)
      } catch (cause) {
        throw toExportError(cause, logger)
      }
      committed = true
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
  const { dialog, fs, getParentWindow, getDefaultDirectory, logger } = deps
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
      const stream = await openStream(fs, tempPath, logger)
      return createWriter({ fs, logger }, stream, path, tempPath)
    }
  }
}
