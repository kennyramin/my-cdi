import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAnonymizeDialog } from '../useAnonymizeDialog'

const IDS = [1, 2]
const RESULT = { anonymized: 2, deletedWithoutVisits: 0, ignored: 0 }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useAnonymizeDialog', () => {
  let resolveCall: (value: unknown) => void
  let anonymize: ReturnType<typeof vi.fn>

  beforeEach(() => {
    anonymize = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve
        })
    )
    vi.stubGlobal('electronAPI', { student: { anonymize } })
  })

  it('opens for the given ids and closes on success', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useAnonymizeDialog({ onSuccess }), { wrapper })
    act(() => result.current.openFor(IDS))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.pendingIds).toEqual(IDS)
    act(() => result.current.confirm())
    await waitFor(() => expect(anonymize).toHaveBeenCalled())
    await act(async () => resolveCall({ success: true, data: RESULT }))
    await waitFor(() => expect(result.current.isOpen).toBe(false))
    expect(onSuccess).toHaveBeenCalledWith(RESULT)
  })

  it('keeps the dialog open, ignores close and a second confirm while pending', async () => {
    const { result } = renderHook(() => useAnonymizeDialog({ onSuccess: vi.fn() }), { wrapper })
    act(() => result.current.openFor(IDS))
    act(() => result.current.confirm())
    await waitFor(() => expect(result.current.isPending).toBe(true))

    act(() => result.current.close())
    expect(result.current.isOpen).toBe(true)
    expect(result.current.isPending).toBe(true)

    act(() => result.current.confirm())
    act(() => result.current.openFor([3]))
    expect(result.current.pendingIds).toEqual(IDS)
    expect(anonymize).toHaveBeenCalledTimes(1)
  })

  it('can be closed again after a failure', async () => {
    const { result } = renderHook(() => useAnonymizeDialog({ onSuccess: vi.fn() }), { wrapper })
    act(() => result.current.openFor(IDS))
    act(() => result.current.confirm())
    await waitFor(() => expect(anonymize).toHaveBeenCalled())
    await act(async () => resolveCall({ success: false, error: 'boom' }))
    await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })
})
