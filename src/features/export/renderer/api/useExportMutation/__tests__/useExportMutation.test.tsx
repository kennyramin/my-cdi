import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorCode } from '@lib/errors'
import type { ExportRequestDto } from '@export-shared'
import { useExportMutation } from '../useExportMutation'
import '@shared/i18n/config'

const REQUEST: ExportRequestDto = { kind: 'journal', includeNames: false }
const ROWS = 3

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useExportMutation', () => {
  const run = vi.fn()

  beforeEach(() => {
    run.mockReset()
    vi.stubGlobal('electronAPI', { export: { run } })
  })

  it('sends the request and resolves with the result data', async () => {
    run.mockResolvedValue({ success: true, data: { path: '/tmp/a.csv', rows: ROWS } })
    const { result } = renderHook(() => useExportMutation(), { wrapper })
    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync(REQUEST)
    })
    expect(run).toHaveBeenCalledWith(REQUEST)
    expect(data).toEqual({ path: '/tmp/a.csv', rows: ROWS })
  })

  it('resolves a cancelled export as data, not an error', async () => {
    run.mockResolvedValue({ success: true, data: { cancelled: true } })
    const { result } = renderHook(() => useExportMutation(), { wrapper })
    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync(REQUEST)
    })
    expect(data).toEqual({ cancelled: true })
  })

  it('throws the resolved message when the IPC call fails', async () => {
    run.mockResolvedValue({ success: false, error: 'raw', code: ErrorCode.EXPORT_FILE_LOCKED })
    const { result } = renderHook(() => useExportMutation(), { wrapper })
    act(() => result.current.mutate(REQUEST))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/\S/)
    expect(result.current.error?.message).not.toBe('raw')
  })

  it('falls back to the raw error without a known code', async () => {
    run.mockResolvedValue({ success: false, error: 'raw failure' })
    const { result } = renderHook(() => useExportMutation(), { wrapper })
    act(() => result.current.mutate(REQUEST))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('raw failure')
  })
})
