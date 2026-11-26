import type { ExportFileAdapter } from '../ports'

export interface FakeFile {
  chunks: string[]
  committed: boolean
  aborted: boolean
}

export interface FakeExportFileAdapterOptions {
  path?: string | null
  failOnPick?: boolean
  failOnOpen?: boolean
  failOnWriteNumber?: number
  failOnCommit?: boolean
}

export interface FakeExportFileAdapter extends ExportFileAdapter {
  pickedDefaultNames: string[]
  openedPaths: string[]
  files: Map<string, FakeFile>
  text(path: string): string
}

const DEFAULT_PATH = '/exports/out.csv'
const FIRST_WRITE_NUMBER = 1

export function createFakeExportFileAdapter(
  options: FakeExportFileAdapterOptions = {}
): FakeExportFileAdapter {
  const path = options.path === undefined ? DEFAULT_PATH : options.path
  const files = new Map<string, FakeFile>()
  const pickedDefaultNames: string[] = []
  const openedPaths: string[] = []

  return {
    pickedDefaultNames,
    openedPaths,
    files,
    text: (target) => (files.get(target)?.chunks ?? []).join(''),
    pickSavePath: async (defaultFileName) => {
      pickedDefaultNames.push(defaultFileName)
      if (options.failOnPick === true) {
        throw new Error('dialog failed')
      }
      return path
    },
    openWriter: async (target) => {
      openedPaths.push(target)
      if (options.failOnOpen === true) {
        throw new Error('EACCES')
      }
      const file: FakeFile = { chunks: [], committed: false, aborted: false }
      files.set(target, file)
      let writeNumber = 0
      return {
        write: async (chunk) => {
          writeNumber += FIRST_WRITE_NUMBER
          if (writeNumber === options.failOnWriteNumber) {
            throw new Error('ENOSPC')
          }
          file.chunks.push(chunk)
        },
        commit: async () => {
          if (options.failOnCommit === true) {
            throw new Error('rename failed')
          }
          file.committed = true
        },
        abort: async () => {
          file.aborted = true
        }
      }
    }
  }
}
