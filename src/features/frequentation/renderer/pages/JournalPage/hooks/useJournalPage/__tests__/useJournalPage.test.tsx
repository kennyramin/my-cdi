import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import i18n from '@shared/i18n/config'
import { useJournalPage } from '../useJournalPage'
import { ActivityType } from '@types'

const SAMPLE_ID = 1
const SAMPLE_STUDENT_ID = 7

function withQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>
  )
}

const wrapper = ({ children }: { children: ReactNode }) => withQuery(children)

const sampleEntry = {
  id: SAMPLE_ID,
  startsAt: '2026-04-01T09:00:00',
  activity: ActivityType.WORK,
  isAnonymized: false,
  student: {
    id: SAMPLE_STUDENT_ID,
    nom: 'A',
    prenom: 'B',
    classe: 'C',
    ine: 'D',
    displayName: 'B A'
  },
  activityLabel: '',
  activityColor: ''
}

describe('useJournalPage', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } })
      },
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        update: vi.fn().mockResolvedValue({ success: true, data: { id: SAMPLE_ID } })
      }
    })
  })

  it('initializes with today and no entry being edited', () => {
    const { result } = renderHook(() => useJournalPage(), { wrapper })
    expect(result.current.selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.editingEntry).toBeNull()
  })

  it('exposes activityOptions covering every ActivityType', () => {
    const { result } = renderHook(() => useJournalPage(), { wrapper })
    expect(result.current.activityOptions).toHaveLength(Object.values(ActivityType).length)
  })

  it('manages editing entry and seeds editingActivity from the entry', () => {
    const { result } = renderHook(() => useJournalPage(), { wrapper })
    act(() => {
      result.current.startEditing(sampleEntry)
    })
    expect(result.current.editingEntry).toEqual(sampleEntry)
    expect(result.current.editingActivity).toBe(ActivityType.WORK)
    act(() => {
      result.current.closeEditDialog()
    })
    expect(result.current.editingEntry).toBeNull()
    expect(result.current.editingActivity).toBeNull()
  })

  it('submitEdit dispatches an update + closes the dialog on success', async () => {
    const { result } = renderHook(() => useJournalPage(), { wrapper })
    act(() => {
      result.current.startEditing(sampleEntry)
    })
    act(() => {
      result.current.setEditingActivity(ActivityType.READING)
    })
    act(() => {
      result.current.submitEdit()
    })
    await waitFor(() => {
      expect(result.current.editingEntry).toBeNull()
    })
    expect(window.electronAPI.frequentation.update).toHaveBeenCalledWith({
      id: SAMPLE_ID,
      activity: ActivityType.READING
    })
  })

  it('submitEdit is a no-op when no entry is being edited', () => {
    const { result } = renderHook(() => useJournalPage(), { wrapper })
    act(() => {
      result.current.submitEdit()
    })
    expect(window.electronAPI.frequentation.update).not.toHaveBeenCalled()
  })

  describe('duplicates response', () => {
    const duplicates = [
      {
        studentId: SAMPLE_STUDENT_ID,
        studentName: 'B A',
        existingStartsAt: '2026-04-01T09:05:00',
        existingActivity: ActivityType.WORK
      }
    ]

    function stubDuplicates() {
      vi.stubGlobal('electronAPI', {
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi
            .fn()
            .mockResolvedValueOnce({ success: true, data: { created: 0, duplicates } })
            .mockResolvedValue({ success: true, data: { id: SAMPLE_ID } })
        }
      })
    }

    it('keeps the edit dialog open and exposes the duplicates', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toEqual(duplicates))
      expect(result.current.editingEntry).not.toBeNull()
    })

    it('cancel only clears the warning', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => result.current.cancelEditDuplicates())
      expect(result.current.pendingEditDuplicates).toEqual([])
      expect(result.current.editingEntry).not.toBeNull()
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledTimes(1)
    })

    it('confirm resends with allowDuplicates and closes on success', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => result.current.confirmEditDuplicates())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenLastCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        allowDuplicates: true
      })
    })

    it('a double confirm sends exactly one resend', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => {
        result.current.confirmEditDuplicates()
        result.current.confirmEditDuplicates()
      })
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      const update = vi.mocked(window.electronAPI.frequentation.update)
      expect(update).toHaveBeenCalledTimes(2)
      expect(update.mock.calls[0][0]).toEqual({ id: SAMPLE_ID, activity: ActivityType.WORK })
      expect(update.mock.calls[1][0]).toEqual({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        allowDuplicates: true
      })
    })

    it('ignores a duplicates result when the edit dialog was closed meanwhile', async () => {
      let release: (value: unknown) => void = () => undefined
      vi.stubGlobal('electronAPI', {
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi.fn().mockReturnValue(
            new Promise((resolve) => {
              release = resolve
            })
          )
        }
      })
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      act(() => result.current.closeEditDialog())
      await act(async () => {
        release({ success: true, data: { created: 0, duplicates } })
      })
      expect(result.current.pendingEditDuplicates).toEqual([])
    })

    it('shows the error in the dialog and keeps the edit dialog when the resend fails', async () => {
      vi.stubGlobal('electronAPI', {
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi
            .fn()
            .mockResolvedValueOnce({ success: true, data: { created: 0, duplicates } })
            .mockResolvedValue({ success: false, error: 'boom' })
        }
      })
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => result.current.confirmEditDuplicates())
      await waitFor(() => expect(result.current.editError).toBe('boom'))
      expect(result.current.editingEntry).not.toBeNull()
      expect(result.current.isSaving).toBe(false)
    })
  })

  describe('edit draft', () => {
    const FUTURE_DATE = '2999-01-01'
    const OTHER_STUDENT_ID = 8

    function stubStudents() {
      vi.stubGlobal('electronAPI', {
        student: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: {
              students: [
                {
                  id: OTHER_STUDENT_ID,
                  nom: 'Durand',
                  prenom: 'Zoé',
                  classe: '5B',
                  ine: 'X',
                  createdAt: '',
                  updatedAt: ''
                }
              ]
            }
          })
        },
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi.fn().mockResolvedValue({ success: true, data: { id: SAMPLE_ID } })
        }
      })
    }

    it('seeds date, time, student and activity from the entry', () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      expect(result.current.editDraft).toEqual({
        date: '2026-04-01',
        time: '09:00',
        studentId: SAMPLE_STUDENT_ID,
        activity: ActivityType.WORK
      })
      expect(result.current.editStudentInputValue).toBe('B A')
      expect(result.current.isEditAnonymized).toBe(false)
      expect(result.current.canSubmitEdit).toBe(true)
    })

    it('flags a future date as not submittable', () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditDate(FUTURE_DATE))
      expect(result.current.isEditFuture).toBe(true)
      expect(result.current.canSubmitEdit).toBe(false)
      act(() => result.current.submitEdit())
      expect(window.electronAPI.frequentation.update).not.toHaveBeenCalled()
    })

    it('refuses an empty time', () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditTime(''))
      expect(result.current.canSubmitEdit).toBe(false)
    })

    it('sends startsAt with local seconds when the time changed', async () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditTime('09:15'))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        startsAt: '2026-04-01T09:15:00'
      })
    })

    it('keeps the stored startsAt untouched when date and time are unchanged', async () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing({ ...sampleEntry, startsAt: '2026-04-01T09:00:42' }))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK
      })
    })

    it('sends the new studentId when the student changed', async () => {
      stubStudents()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      await waitFor(() => expect(result.current.studentOptions).toHaveLength(1))
      act(() => result.current.startEditing(sampleEntry))
      act(() =>
        result.current.setEditStudent({ value: OTHER_STUDENT_ID, label: 'Zoé Durand', badge: '5B' })
      )
      expect(result.current.editStudentInputValue).toBe('Zoé Durand')
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        studentId: OTHER_STUDENT_ID
      })
    })

    it('refuses to save while the student text does not match the selection', async () => {
      stubStudents()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      await waitFor(() => expect(result.current.studentOptions).toHaveLength(1))
      act(() => result.current.startEditing(sampleEntry))
      expect(result.current.editStudentMessage).toBeNull()

      act(() => result.current.setEditStudentInputValue(''))
      expect(result.current.canSubmitEdit).toBe(false)
      expect(result.current.editStudentMessage).toBe('Sélectionnez un élève dans la liste')

      act(() => result.current.setEditStudentInputValue('Zo'))
      expect(result.current.canSubmitEdit).toBe(false)
      act(() => result.current.submitEdit())
      expect(window.electronAPI.frequentation.update).not.toHaveBeenCalled()
    })

    it('re-selecting the same student sends nothing for the student', async () => {
      stubStudents()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      await waitFor(() => expect(result.current.studentOptions).toHaveLength(1))
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditStudentInputValue(''))
      act(() =>
        result.current.setEditStudent({ value: SAMPLE_STUDENT_ID, label: 'B A', badge: 'C' })
      )
      expect(result.current.canSubmitEdit).toBe(true)
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK
      })
    })

    it('does not require a student selection for an anonymized entry', () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() =>
        result.current.startEditing({
          ...sampleEntry,
          isAnonymized: true,
          student: { ...sampleEntry.student, id: null, displayName: 'Élève anonymisé' }
        })
      )
      expect(result.current.editStudentMessage).toBeNull()
      expect(result.current.canSubmitEdit).toBe(true)
    })

    it('explains an empty time with a required message', () => {
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      expect(result.current.editDateTimeMessage).toBeNull()
      act(() => result.current.setEditTime(''))
      expect(result.current.editDateTimeMessage).toBe("Renseignez la date et l'heure")
    })

    it('flags a later time today as future and accepts midnight', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-04-01T12:00:00'))
      try {
        const { result } = renderHook(() => useJournalPage(), { wrapper })
        act(() => result.current.startEditing(sampleEntry))
        act(() => result.current.setEditDate('2026-04-01'))
        act(() => result.current.setEditTime('12:30'))
        expect(result.current.isEditFuture).toBe(true)
        expect(result.current.editDateTimeMessage).toBe(
          "Impossible d'enregistrer une présence dans le futur"
        )
        act(() => result.current.setEditTime('00:00'))
        expect(result.current.isEditFuture).toBe(false)
        expect(result.current.editMaxDate).toBe('2026-04-01')
      } finally {
        vi.useRealTimers()
      }
    })

    it('re-checks the future rule at submit time (clock moved since last render)', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-04-01T12:00:00'))
      try {
        const { result } = renderHook(() => useJournalPage(), { wrapper })
        act(() => result.current.startEditing(sampleEntry))
        act(() => result.current.setEditDate('2026-04-01'))
        act(() => result.current.setEditTime('11:59'))
        vi.setSystemTime(new Date('2026-04-01T11:00:00'))
        act(() => result.current.submitEdit())
        expect(window.electronAPI.frequentation.update).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('never sends a studentId for an anonymized entry', async () => {
      const anonymized = {
        ...sampleEntry,
        isAnonymized: true,
        student: { ...sampleEntry.student, id: null }
      }
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(anonymized))
      expect(result.current.isEditAnonymized).toBe(true)
      expect(result.current.canSubmitEdit).toBe(true)
      act(() => result.current.setEditTime('10:00'))
      act(() => result.current.setEditStudent({ value: OTHER_STUDENT_ID, label: 'Zoé Durand' }))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      const payload = vi.mocked(window.electronAPI.frequentation.update).mock.calls[0][0]
      expect(payload).toEqual({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        startsAt: '2026-04-01T10:00:00'
      })
      expect(payload).not.toHaveProperty('studentId')
    })

    it('keeps the whole draft when the warning is cancelled', async () => {
      const duplicates = [
        {
          studentId: SAMPLE_STUDENT_ID,
          studentName: 'B A',
          existingStartsAt: '2026-04-01T09:20:00',
          existingActivity: ActivityType.WORK
        }
      ]
      vi.stubGlobal('electronAPI', {
        student: { list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } }) },
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi.fn().mockResolvedValue({ success: true, data: { created: 0, duplicates } })
        }
      })
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditTime('09:15'))
      act(() => result.current.setEditingActivity(ActivityType.READING))
      const draftBefore = result.current.editDraft
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => result.current.cancelEditDuplicates())
      expect(result.current.editDraft).toEqual(draftBefore)
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledTimes(1)
    })

    it('resends the changed fields with allowDuplicates on confirm', async () => {
      const duplicates = [
        {
          studentId: SAMPLE_STUDENT_ID,
          studentName: 'B A',
          existingStartsAt: '2026-04-01T09:20:00',
          existingActivity: ActivityType.WORK
        }
      ]
      vi.stubGlobal('electronAPI', {
        student: { list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } }) },
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi
            .fn()
            .mockResolvedValueOnce({ success: true, data: { created: 0, duplicates } })
            .mockResolvedValue({ success: true, data: { id: SAMPLE_ID } })
        }
      })
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditTime('09:15'))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingEditDuplicates).toHaveLength(1))
      act(() => result.current.confirmEditDuplicates())
      await waitFor(() => expect(result.current.editingEntry).toBeNull())
      expect(window.electronAPI.frequentation.update).toHaveBeenLastCalledWith({
        id: SAMPLE_ID,
        activity: ActivityType.WORK,
        startsAt: '2026-04-01T09:15:00',
        allowDuplicates: true
      })
    })

    it('keeps the dialog open and exposes the error on STUDENT_NOT_FOUND', async () => {
      vi.stubGlobal('electronAPI', {
        student: { list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } }) },
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
          update: vi.fn().mockResolvedValue({ success: false, error: 'STUDENT_NOT_FOUND' })
        }
      })
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.setEditTime('09:15'))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.editError).not.toBeNull())
      expect(result.current.editingEntry).not.toBeNull()
      expect(result.current.editDraft?.time).toBe('09:15')
      act(() => result.current.setEditTime('09:20'))
      expect(result.current.editError).toBeNull()
    })
  })
})
