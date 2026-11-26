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
  startsAt: '2026-04-01T09:00:00.000Z',
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
      await waitFor(() => expect(result.current.pendingDuplicates).toEqual(duplicates))
      expect(result.current.editingEntry).not.toBeNull()
    })

    it('cancel only clears the warning', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingDuplicates).toHaveLength(1))
      act(() => result.current.cancelDuplicates())
      expect(result.current.pendingDuplicates).toEqual([])
      expect(result.current.editingEntry).not.toBeNull()
      expect(window.electronAPI.frequentation.update).toHaveBeenCalledTimes(1)
    })

    it('confirm resends with allowDuplicates and closes on success', async () => {
      stubDuplicates()
      const { result } = renderHook(() => useJournalPage(), { wrapper })
      act(() => result.current.startEditing(sampleEntry))
      act(() => result.current.submitEdit())
      await waitFor(() => expect(result.current.pendingDuplicates).toHaveLength(1))
      act(() => result.current.confirmDuplicates())
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
      await waitFor(() => expect(result.current.pendingDuplicates).toHaveLength(1))
      act(() => {
        result.current.confirmDuplicates()
        result.current.confirmDuplicates()
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
      expect(result.current.pendingDuplicates).toEqual([])
    })

    it('shows an error toast and keeps the edit dialog when the resend fails', async () => {
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
      await waitFor(() => expect(result.current.pendingDuplicates).toHaveLength(1))
      act(() => result.current.confirmDuplicates())
      await waitFor(() => expect(result.current.toast?.severity).toBe('error'))
      expect(result.current.editingEntry).not.toBeNull()
      expect(result.current.isSaving).toBe(false)
    })
  })
})
