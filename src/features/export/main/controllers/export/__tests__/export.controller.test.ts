import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcMain } from 'electron'
import { EXPORT_CHANNELS } from '@shared/ipc/channels'
import { ErrorCode } from '@lib/errors'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import { createFakeExportFileAdapter } from '../../../test-helpers'
import { registerExportController } from '../export.controller'

type IpcHandler = Parameters<IpcMain['handle']>[1]

function createIpcMainStub() {
  const handlers = new Map<string, IpcHandler>()
  const handle: IpcMain['handle'] = (channel, listener) => {
    handlers.set(channel, listener)
  }
  return {
    handle,
    invoke: async (channel: string, payload: unknown): Promise<unknown> => {
      const listener = handlers.get(channel)
      if (!listener) {
        throw new Error(`No handler for ${channel}`)
      }
      return listener(Object.create(null), payload)
    },
    registeredChannels: () => Array.from(handlers.keys())
  }
}

const frequentationGateway: FrequentationGateway = {
  create: vi.fn(),
  createManyChecked: vi.fn(),
  updateChecked: vi.fn(),
  getById: vi.fn(),
  getWithStudentById: vi.fn(),
  getAll: vi.fn(),
  getByStudentId: vi.fn(),
  getByDateRange: vi.fn().mockResolvedValue([]),
  update: vi.fn(),
  delete: vi.fn(),
  deleteByStudentId: vi.fn(),
  count: vi.fn()
}
const studentGateway: StudentGateway = {
  create: vi.fn(),
  getById: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getByIds: vi.fn(),
  getAllWithVisitCount: vi.fn().mockResolvedValue([]),
  countVisitsByStudentId: vi.fn(),
  anonymizeByIds: vi.fn(),
  checkpoint: vi.fn(),
  withTransaction: vi.fn()
}

const JOURNAL_REQUEST = {
  kind: 'journal',
  period: { startDate: '2026-01-01', endDate: '2026-01-31' },
  includeNames: false
}

describe('registerExportController', () => {
  let ipcMain: ReturnType<typeof createIpcMainStub>

  function register(fileAdapter = createFakeExportFileAdapter()) {
    registerExportController(ipcMain, { frequentationGateway, studentGateway, fileAdapter })
    return fileAdapter
  }

  beforeEach(() => {
    ipcMain = createIpcMainStub()
  })

  it('registers export.run and returns the use case result', async () => {
    const adapter = register()

    expect(ipcMain.registeredChannels()).toEqual([EXPORT_CHANNELS.RUN])
    const result = await ipcMain.invoke(EXPORT_CHANNELS.RUN, JOURNAL_REQUEST)

    expect(result).toEqual({ success: true, data: { path: '/exports/out.csv', rows: 0 } })
    expect(adapter.files.get('/exports/out.csv')?.committed).toBe(true)
  })

  it('a cancelled result is returned as success { cancelled: true }', async () => {
    register(createFakeExportFileAdapter({ path: null }))

    const result = await ipcMain.invoke(EXPORT_CHANNELS.RUN, JOURNAL_REQUEST)

    expect(result).toEqual({ success: true, data: { cancelled: true } })
  })

  it('a write failure is returned with code EXPORT_WRITE_FAILED', async () => {
    register(createFakeExportFileAdapter({ failOnOpen: true }))

    const result = await ipcMain.invoke(EXPORT_CHANNELS.RUN, JOURNAL_REQUEST)

    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
  })

  it('students request without acknowledgement is rejected through the router with VALIDATION_ERROR', async () => {
    const adapter = register()

    const result = await ipcMain.invoke(EXPORT_CHANNELS.RUN, { kind: 'students' })

    expect(result).toMatchObject({
      success: false,
      code: ErrorCode.VALIDATION_ERROR
    })
    expect(adapter.pickedDefaultNames).toEqual([])
  })

  it('a malformed payload is rejected with VALIDATION_ERROR', async () => {
    register()

    const result = await ipcMain.invoke(EXPORT_CHANNELS.RUN, null)

    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
  })
})
