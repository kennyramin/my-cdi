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
        createBatch: vi.fn().mockResolvedValue({ success: true, data: { created: SECOND_ID } })
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
})
