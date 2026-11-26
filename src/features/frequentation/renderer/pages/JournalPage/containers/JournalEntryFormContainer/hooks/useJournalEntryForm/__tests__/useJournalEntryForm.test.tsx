import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useJournalEntryForm } from '../useJournalEntryForm'
import { ActivityType } from '@types'
import '@shared/i18n/config'

const FIRST_ID = 1
const SECOND_ID = 2
const NOW_LOCAL = '2026-11-25T14:30:00'

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useJournalEntryForm', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } })
      },
      frequentation: {
        createBatch: vi
          .fn()
          .mockResolvedValue({ success: true, data: { created: SECOND_ID, errors: [] } })
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags a selected date after today', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW_LOCAL))
    const future = renderHook(() => useJournalEntryForm({ selectedDate: '2026-11-26' }), {
      wrapper: createWrapper()
    })
    const today = renderHook(() => useJournalEntryForm({ selectedDate: '2026-11-25' }), {
      wrapper: createWrapper()
    })
    expect(future.result.current.isFutureDate).toBe(true)
    expect(today.result.current.isFutureDate).toBe(false)
  })

  it("refuses submit when today's time is later than now", () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW_LOCAL))
    const { result } = renderHook(() => useJournalEntryForm({ selectedDate: '2026-11-25' }), {
      wrapper: createWrapper()
    })

    act(() => {
      result.current.handleSubmit({
        studentIds: [FIRST_ID],
        activity: ActivityType.WORK,
        time: '15:00'
      })
    })

    expect(window.electronAPI.frequentation.createBatch).not.toHaveBeenCalled()
    expect(result.current.toast).toMatchObject({
      message: "Impossible d'enregistrer une présence dans le futur",
      severity: 'error'
    })
  })

  it('submits the batch and calls onSubmitted on success', async () => {
    const onSubmitted = vi.fn()
    const { result } = renderHook(
      () => useJournalEntryForm({ selectedDate: '2026-04-01', onSubmitted }),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.handleSubmit({
        studentIds: [FIRST_ID, SECOND_ID],
        activity: ActivityType.WORK,
        time: '10:30'
      })
    })
    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalled()
    })
    expect(window.electronAPI.frequentation.createBatch).toHaveBeenCalledOnce()
  })

  describe('duplicate warning', () => {
    const FORM_VALUES = {
      studentIds: [FIRST_ID, SECOND_ID],
      activity: ActivityType.READING,
      time: '10:30'
    }
    const DUPLICATE = {
      studentId: FIRST_ID,
      studentName: 'Jean Dupont',
      existingStartsAt: '2026-04-01T10:15:00',
      existingActivity: ActivityType.WORK
    }

    function mockDuplicatesThen(second: unknown) {
      window.electronAPI.frequentation.createBatch = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: { created: 0, duplicates: [DUPLICATE] } })
        .mockResolvedValueOnce(second)
    }

    async function submitWithDuplicates(
      second: unknown = { success: true, data: { created: 2, errors: [] } }
    ) {
      mockDuplicatesThen(second)
      const hook = renderHook(() => useJournalEntryForm({ selectedDate: '2026-04-01' }), {
        wrapper: createWrapper()
      })
      act(() => {
        hook.result.current.form.reset(FORM_VALUES)
      })
      act(() => {
        hook.result.current.handleSubmit(FORM_VALUES)
      })
      await waitFor(() => {
        expect(hook.result.current.pendingDuplicates).toEqual([DUPLICATE])
      })
      return hook
    }

    it('keeps the form and shows no success toast when duplicates are found', async () => {
      const { result } = await submitWithDuplicates()
      expect(result.current.form.getValues()).toEqual(FORM_VALUES)
      expect(result.current.toast).toBeNull()
    })

    it('cancel clears the warning, keeps the form and sends nothing', async () => {
      const { result } = await submitWithDuplicates()
      act(() => {
        result.current.cancelDuplicates()
      })
      expect(result.current.pendingDuplicates).toEqual([])
      expect(result.current.form.getValues()).toEqual(FORM_VALUES)
      expect(window.electronAPI.frequentation.createBatch).toHaveBeenCalledOnce()
    })

    it('confirm resends the same payload with allowDuplicates, resets and toasts success', async () => {
      const onSubmitted = vi.fn()
      mockDuplicatesThen({ success: true, data: { created: 2, errors: [] } })
      const { result } = renderHook(
        () => useJournalEntryForm({ selectedDate: '2026-04-01', onSubmitted }),
        { wrapper: createWrapper() }
      )
      act(() => {
        result.current.handleSubmit(FORM_VALUES)
      })
      await waitFor(() => {
        expect(result.current.pendingDuplicates).toHaveLength(1)
      })
      act(() => {
        result.current.confirmDuplicates()
      })
      expect(result.current.pendingDuplicates).toEqual([])
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'success' })
      })
      const calls = vi.mocked(window.electronAPI.frequentation.createBatch).mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[1]?.[0]).toEqual({ ...calls[0]?.[0], allowDuplicates: true })
      expect(onSubmitted).toHaveBeenCalledOnce()
      expect(result.current.form.getValues().studentIds).toEqual([])
    })

    it('ignores a confirmation when no warning is pending', () => {
      const { result } = renderHook(() => useJournalEntryForm({ selectedDate: '2026-04-01' }), {
        wrapper: createWrapper()
      })
      act(() => {
        result.current.confirmDuplicates()
      })
      expect(window.electronAPI.frequentation.createBatch).not.toHaveBeenCalled()
    })

    it('sends a single request when confirm is triggered twice quickly', async () => {
      const { result } = await submitWithDuplicates()
      act(() => {
        result.current.confirmDuplicates()
        result.current.confirmDuplicates()
      })
      await waitFor(() => {
        expect(result.current.toast).not.toBeNull()
      })
      expect(window.electronAPI.frequentation.createBatch).toHaveBeenCalledTimes(2)
    })

    it('shows an error toast and keeps the form when the confirmed save fails', async () => {
      const { result } = await submitWithDuplicates({
        success: false,
        error: 'boom',
        code: 'DATABASE_ERROR'
      })
      act(() => {
        result.current.confirmDuplicates()
      })
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'error' })
      })
      expect(result.current.form.getValues()).toEqual(FORM_VALUES)
    })
  })

  describe('batch item errors', () => {
    it('reports an all-failed batch as an error and keeps the form', async () => {
      window.electronAPI.frequentation.createBatch = vi.fn().mockResolvedValue({
        success: true,
        data: { created: 0, errors: [{ index: 0, error: 'Item 0: Student not found' }] }
      })
      const onSubmitted = vi.fn()
      const { result } = renderHook(
        () => useJournalEntryForm({ selectedDate: '2026-04-01', onSubmitted }),
        { wrapper: createWrapper() }
      )
      const values = { studentIds: [FIRST_ID], activity: ActivityType.WORK, time: '10:30' }
      act(() => {
        result.current.form.reset(values)
        result.current.handleSubmit(values)
      })
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'error' })
      })
      expect(result.current.toast?.message).toContain('Aucune présence enregistrée')
      expect(result.current.form.getValues()).toEqual(values)
      expect(onSubmitted).not.toHaveBeenCalled()
    })

    it('says how many students were not found when nothing was saved', async () => {
      window.electronAPI.frequentation.createBatch = vi.fn().mockResolvedValue({
        success: true,
        data: {
          created: 0,
          errors: [
            { index: 0, error: 'Item 0: Student not found' },
            { index: 1, error: 'Item 1: Student not found' }
          ]
        }
      })
      const { result } = renderHook(() => useJournalEntryForm({ selectedDate: '2026-04-01' }), {
        wrapper: createWrapper()
      })
      act(() => {
        result.current.handleSubmit({
          studentIds: [FIRST_ID, SECOND_ID],
          activity: ActivityType.WORK,
          time: '10:30'
        })
      })
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'error' })
      })
      expect(result.current.toast?.message).toBe(
        'Aucune présence enregistrée : 2 élève(s) introuvable(s).'
      )
    })

    it('keeps only the failed students for a retry when some items were saved', async () => {
      window.electronAPI.frequentation.createBatch = vi.fn().mockResolvedValue({
        success: true,
        data: { created: 1, errors: [{ index: 1, error: 'Item 1: Student not found' }] }
      })
      const onSubmitted = vi.fn()
      const { result } = renderHook(
        () => useJournalEntryForm({ selectedDate: '2026-04-01', onSubmitted }),
        { wrapper: createWrapper() }
      )
      const values = {
        studentIds: [FIRST_ID, SECOND_ID],
        activity: ActivityType.READING,
        time: '10:30'
      }
      act(() => {
        result.current.form.reset(values)
      })
      act(() => {
        result.current.handleSubmit(values)
      })
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'warning' })
      })
      expect(result.current.toast?.message).toBe(
        '1 présence(s) enregistrée(s). 1 élève(s) introuvable(s), toujours sélectionné(s) pour réessayer.'
      )
      expect(result.current.form.getValues()).toEqual({ ...values, studentIds: [SECOND_ID] })
      expect(onSubmitted).toHaveBeenCalledOnce()
    })

    it('ignores an error whose index matches no submitted item', async () => {
      window.electronAPI.frequentation.createBatch = vi.fn().mockResolvedValue({
        success: true,
        data: { created: 1, errors: [{ index: 7, error: 'Item 7: boom' }] }
      })
      const { result } = renderHook(() => useJournalEntryForm({ selectedDate: '2026-04-01' }), {
        wrapper: createWrapper()
      })
      const values = { studentIds: [FIRST_ID], activity: ActivityType.WORK, time: '10:30' }
      act(() => {
        result.current.form.reset(values)
      })
      act(() => {
        result.current.handleSubmit(values)
      })
      await waitFor(() => {
        expect(result.current.toast).toMatchObject({ severity: 'warning' })
      })
      expect(result.current.form.getValues().studentIds).toEqual([])
    })
  })
})
