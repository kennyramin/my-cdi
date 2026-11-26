import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcMain } from 'electron'
import { BACKUP_CHANNELS } from '@shared/ipc/channels'
import { AppError, ErrorCode } from '@lib/errors'
import { registerBackupController, type BackupHandlers } from '../backup.controller'

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

function createHandlers(): {
  [K in keyof BackupHandlers]: ReturnType<typeof vi.fn<BackupHandlers[K]>>
} {
  return {
    create: vi.fn<BackupHandlers['create']>().mockResolvedValue({ path: '/x/a.db' }),
    selectRestore: vi.fn<BackupHandlers['selectRestore']>().mockResolvedValue({ fileName: 'a.db' }),
    confirmRestore: vi.fn<BackupHandlers['confirmRestore']>().mockResolvedValue({ restored: true }),
    getStatus: vi
      .fn<BackupHandlers['getStatus']>()
      .mockResolvedValue({ lastBackupAt: null, automaticCount: 2 }),
    deleteAutomatic: vi.fn<BackupHandlers['deleteAutomatic']>().mockResolvedValue({ deleted: 2 })
  }
}

describe('registerBackupController', () => {
  let ipcMain: ReturnType<typeof createIpcMainStub>
  let handlers: ReturnType<typeof createHandlers>

  beforeEach(() => {
    ipcMain = createIpcMainStub()
    handlers = createHandlers()
    registerBackupController(ipcMain, handlers)
  })

  it('registers the four BACKUP_CHANNELS', () => {
    expect(ipcMain.registeredChannels().sort()).toEqual(Object.values(BACKUP_CHANNELS).sort())
  })

  it('wraps results in { success: true, data }', async () => {
    expect(await ipcMain.invoke(BACKUP_CHANNELS.CREATE, undefined)).toEqual({
      success: true,
      data: { path: '/x/a.db' }
    })
    expect(await ipcMain.invoke(BACKUP_CHANNELS.GET_STATUS, undefined)).toEqual({
      success: true,
      data: { lastBackupAt: null, automaticCount: 2 }
    })
    expect(await ipcMain.invoke(BACKUP_CHANNELS.DELETE_AUTOMATIC, undefined)).toEqual({
      success: true,
      data: { deleted: 2 }
    })
  })

  it('routes the select and confirm phases of restore', async () => {
    expect(await ipcMain.invoke(BACKUP_CHANNELS.RESTORE, { phase: 'select' })).toEqual({
      success: true,
      data: { fileName: 'a.db' }
    })
    expect(await ipcMain.invoke(BACKUP_CHANNELS.RESTORE, { phase: 'confirm' })).toEqual({
      success: true,
      data: { restored: true }
    })
  })

  it('rejects an unknown phase', async () => {
    const result = await ipcMain.invoke(BACKUP_CHANNELS.RESTORE, { phase: 'nope' })

    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(handlers.selectRestore).not.toHaveBeenCalled()
    expect(handlers.confirmRestore).not.toHaveBeenCalled()
  })

  it('does not accept a path from the renderer', async () => {
    const result = await ipcMain.invoke(BACKUP_CHANNELS.RESTORE, { path: '/etc/passwd' })

    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(handlers.selectRestore).not.toHaveBeenCalled()
    expect(handlers.confirmRestore).not.toHaveBeenCalled()
  })

  it('surfaces typed AppError codes', async () => {
    handlers.create.mockRejectedValueOnce(new AppError(ErrorCode.BACKUP_PATH_IS_LIVE_DB, 'live'))

    const result = await ipcMain.invoke(BACKUP_CHANNELS.CREATE, undefined)

    expect(result).toEqual({
      success: false,
      error: 'live',
      code: ErrorCode.BACKUP_PATH_IS_LIVE_DB
    })
  })
})
