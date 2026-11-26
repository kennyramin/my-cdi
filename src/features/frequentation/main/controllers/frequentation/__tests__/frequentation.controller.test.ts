import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import { ActivityType } from '@types'
import { registerFrequentationController } from '../frequentation.controller'
import { FREQUENTATION_CHANNELS } from '@shared/ipc/channels'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type {
  FrequentationEntity,
  FrequentationWithStudentEntity
} from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import { ErrorCode } from '@lib/errors'

const STUDENT_ID = 1
const FREQUENTATION_ID = 1

const SAMPLE_FREQUENTATION: FrequentationEntity = {
  id: FREQUENTATION_ID,
  startsAt: '2026-01-15T09:00:00.000Z',
  activity: ActivityType.WORK,
  studentId: STUDENT_ID,
  studentClasse: null,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z'
}

type IpcMainHandle = Pick<IpcMain, 'handle'>
type IpcHandler = Parameters<IpcMain['handle']>[1]

interface IpcMainStub extends IpcMainHandle {
  invoke: (channel: string, payload: unknown) => Promise<unknown>
  registeredChannels: () => string[]
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
    },
    registeredChannels: () => Array.from(handlers.keys())
  }
}

function createFrequentationGatewayStub(): FrequentationGateway {
  return {
    create: vi.fn().mockResolvedValue(SAMPLE_FREQUENTATION),
    getById: vi.fn().mockResolvedValue(SAMPLE_FREQUENTATION),
    getAll: vi.fn().mockResolvedValue([]),
    getByStudentId: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(SAMPLE_FREQUENTATION),
    delete: vi.fn().mockResolvedValue(true),
    deleteByStudentId: vi.fn().mockResolvedValue(0),
    createManyChecked: vi.fn(),
    updateChecked: vi.fn(),
    getWithStudentById: vi.fn(),
    count: vi.fn().mockResolvedValue(0)
  }
}

function createStudentGatewayStub(): StudentGateway {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByIds: vi.fn().mockResolvedValue([
      {
        id: STUDENT_ID,
        nom: 'Dupont',
        prenom: 'Marie',
        classe: '6A',
        ine: 'INE1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]),
    getAllWithVisitCount: vi.fn(),
    countVisitsByStudentId: vi.fn(),
    anonymizeByIds: vi.fn(),
    checkpoint: vi.fn(),
    withTransaction: vi.fn()
  }
}

const UPDATED_WITH_STUDENT: FrequentationWithStudentEntity = {
  ...SAMPLE_FREQUENTATION,
  activity: ActivityType.READING,
  studentNom: 'Dupont',
  studentPrenom: 'Marie',
  studentClasse: '6A',
  studentIne: null
}

describe('registerFrequentationController', () => {
  let ipcMain: IpcMainStub
  let frequentationGateway: FrequentationGateway
  let studentGateway: StudentGateway

  beforeEach(() => {
    ipcMain = createIpcMainStub()
    frequentationGateway = createFrequentationGatewayStub()
    studentGateway = createStudentGatewayStub()
    registerFrequentationController(ipcMain, frequentationGateway, studentGateway)
  })

  it('registers every channel from FREQUENTATION_CHANNELS', () => {
    const registered = ipcMain.registeredChannels()
    for (const channel of Object.values(FREQUENTATION_CHANNELS)) {
      expect(registered).toContain(channel)
    }
  })

  it('registers create handler that delegates to use-case', async () => {
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.CREATE, {
      startsAt: '2026-01-15T09:00:00',
      activity: ActivityType.WORK,
      studentId: 1
    })
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ activity: 'work' })
    })
    expect(frequentationGateway.create).toHaveBeenCalledOnce()
  })

  it('returns IpcResult error when use case fails', async () => {
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.CREATE, {
      startsAt: '',
      activity: ActivityType.WORK,
      studentId: 1
    })
    expect(result).toEqual(expect.objectContaining({ success: false }))
  })

  it('maps an updated entry to a response dto', async () => {
    vi.mocked(frequentationGateway.updateChecked).mockResolvedValue({
      written: SAMPLE_FREQUENTATION
    })
    vi.mocked(frequentationGateway.getWithStudentById).mockResolvedValue(UPDATED_WITH_STUDENT)
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.UPDATE, {
      id: FREQUENTATION_ID,
      activity: ActivityType.READING
    })
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: FREQUENTATION_ID,
        activity: 'reading',
        studentName: 'Marie Dupont'
      })
    })
  })

  it('maps duplicates found by an update to a DuplicatesFoundDto', async () => {
    vi.mocked(frequentationGateway.updateChecked).mockResolvedValue({
      duplicates: [
        {
          studentId: STUDENT_ID,
          existingId: 7,
          existingStartsAt: '2026-01-15T09:10:00',
          existingActivity: ActivityType.GAME
        }
      ]
    })
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.UPDATE, {
      id: FREQUENTATION_ID,
      startsAt: '2026-01-15T09:05:00'
    })
    expect(result).toEqual({
      success: true,
      data: {
        created: 0,
        duplicates: [
          {
            studentId: STUDENT_ID,
            studentName: 'Marie Dupont',
            existingStartsAt: '2026-01-15T09:10:00',
            existingActivity: ActivityType.GAME
          }
        ]
      }
    })
  })

  it('maps a created batch to a created count and its errors', async () => {
    vi.mocked(frequentationGateway.createManyChecked).mockResolvedValue({
      written: [SAMPLE_FREQUENTATION]
    })
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.CREATE_BATCH, {
      frequentations: [
        { startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: STUDENT_ID }
      ]
    })
    expect(result).toEqual({ success: true, data: { created: 1, errors: [] } })
  })

  it('maps batch duplicates to a DuplicatesFoundDto', async () => {
    vi.mocked(frequentationGateway.createManyChecked).mockResolvedValue({
      duplicates: [
        {
          studentId: STUDENT_ID,
          existingId: 7,
          existingStartsAt: '2026-01-15T09:10:00',
          existingActivity: ActivityType.GAME
        }
      ]
    })
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.CREATE_BATCH, {
      frequentations: [
        { startsAt: '2026-01-15T09:00:00', activity: ActivityType.WORK, studentId: STUDENT_ID }
      ]
    })
    expect(result).toEqual({
      success: true,
      data: {
        created: 0,
        duplicates: [
          {
            studentId: STUDENT_ID,
            studentName: 'Marie Dupont',
            existingStartsAt: '2026-01-15T09:10:00',
            existingActivity: ActivityType.GAME
          }
        ]
      }
    })
  })

  it('returns an error result for an invalid update payload', async () => {
    const result = await ipcMain.invoke(FREQUENTATION_CHANNELS.UPDATE, {
      id: FREQUENTATION_ID,
      startsAt: '2026-01-15 09:00'
    })
    expect(result).toEqual(
      expect.objectContaining({ success: false, code: ErrorCode.VALIDATION_ERROR })
    )
  })
})
