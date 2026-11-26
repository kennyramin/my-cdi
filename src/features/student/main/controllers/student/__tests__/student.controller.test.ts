import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import { registerStudentController } from '../student.controller'
import { ErrorCode } from '@lib/errors'
import { STUDENT_CHANNELS } from '@shared/ipc/channels'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'

const STUDENT_ID = 1

const SAMPLE_ENTITY: StudentEntity = {
  id: STUDENT_ID,
  nom: 'Dupont',
  prenom: 'Jean',
  classe: '3B',
  ine: 'INE1',
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z'
}

type AnonymizeBackup = (reason: 'anonymization') => Promise<string>

type IpcMainHandle = Pick<IpcMain, 'handle'>
type IpcHandler = Parameters<IpcMain['handle']>[1]

interface IpcMainStub extends IpcMainHandle {
  invoke: (channel: string, payload: unknown) => Promise<unknown>
}

function createIpcMainStub(): IpcMainStub {
  const handlers = new Map<string, IpcHandler>()
  const handle: IpcMain['handle'] = (channel, listener) => {
    handlers.set(channel, listener)
  }
  return {
    handle,
    invoke: async (channel, payload) => {
      const listener = handlers.get(channel)
      if (!listener) {
        throw new Error(`No handler for ${channel}`)
      }
      const fakeEvent = Object.create(null)
      return listener(fakeEvent, payload)
    }
  }
}

function createGatewayStub(): StudentGateway {
  return {
    create: vi.fn().mockResolvedValue(SAMPLE_ENTITY),
    update: vi.fn().mockResolvedValue(SAMPLE_ENTITY),
    delete: vi.fn().mockResolvedValue(true),
    getById: vi.fn().mockResolvedValue(SAMPLE_ENTITY),
    getAll: vi.fn().mockResolvedValue([]),
    getByIds: vi.fn().mockResolvedValue([]),
    getAllWithVisitCount: vi.fn().mockResolvedValue([]),
    countVisitsByStudentId: vi.fn().mockResolvedValue(0),
    anonymizeByIds: vi.fn().mockResolvedValue({ anonymized: 0, deletedWithoutVisits: 0 }),
    checkpoint: vi.fn().mockResolvedValue(undefined),
    withTransaction: vi.fn().mockImplementation((work: () => Promise<unknown>) => work())
  }
}

describe('registerStudentController', () => {
  let ipcMain: IpcMainStub
  let gateway: StudentGateway
  let createAutomaticBackup: AnonymizeBackup

  beforeEach(() => {
    ipcMain = createIpcMainStub()
    gateway = createGatewayStub()
    createAutomaticBackup = vi.fn().mockResolvedValue('/backup.db')
  })

  it('registers create handler that delegates to use-case', async () => {
    registerStudentController(ipcMain, gateway, createAutomaticBackup)
    const result = await ipcMain.invoke(STUDENT_CHANNELS.CREATE, {
      nom: 'Dupont',
      prenom: 'Jean',
      classe: '3B',
      ine: 'INE1'
    })
    expect(result).toEqual({ success: true, data: expect.objectContaining({ nom: 'Dupont' }) })
    expect(gateway.create).toHaveBeenCalledOnce()
  })

  it('registers every channel from STUDENT_CHANNELS', () => {
    registerStudentController(ipcMain, gateway, createAutomaticBackup)
    for (const channel of Object.values(STUDENT_CHANNELS)) {
      expect(() => ipcMain.invoke(channel, {})).not.toThrow()
    }
  })

  it('student.anonymize delegates and unwraps', async () => {
    vi.mocked(gateway.getByIds).mockResolvedValue([SAMPLE_ENTITY])
    vi.mocked(gateway.anonymizeByIds).mockResolvedValue({ anonymized: 1, deletedWithoutVisits: 0 })
    registerStudentController(ipcMain, gateway, createAutomaticBackup)
    const result = await ipcMain.invoke(STUDENT_CHANNELS.ANONYMIZE, { ids: [STUDENT_ID] })
    expect(result).toEqual({
      success: true,
      data: { anonymized: 1, deletedWithoutVisits: 0, ignored: 0 }
    })
    expect(createAutomaticBackup).toHaveBeenCalledWith('anonymization')
  })

  it('student.previewCsvRemoval delegates', async () => {
    vi.mocked(gateway.getAll).mockResolvedValue([SAMPLE_ENTITY])
    registerStudentController(ipcMain, gateway, createAutomaticBackup)
    const result = await ipcMain.invoke(STUDENT_CHANNELS.PREVIEW_CSV_REMOVAL, {
      csv: 'nom;prenom;classe;ine\nMartin;Pierre;3A;INE2'
    })
    expect(result).toEqual({
      success: true,
      data: { toRemove: 1, total: 1, sample: ['Jean Dupont'], fingerprint: expect.any(String) }
    })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })

  it('student.anonymize rejects an invalid payload with VALIDATION_ERROR', async () => {
    registerStudentController(ipcMain, gateway, createAutomaticBackup)
    const result = await ipcMain.invoke(STUDENT_CHANNELS.ANONYMIZE, {})
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(createAutomaticBackup).not.toHaveBeenCalled()
  })
})
