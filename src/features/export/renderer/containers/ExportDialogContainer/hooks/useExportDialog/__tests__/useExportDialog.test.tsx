import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorCode } from '@lib/errors'
import type { ExportScopeProps } from '../../../types/ExportScopeProps'
import { useExportDialog } from '../useExportDialog'
import '@shared/i18n/config'

const PERIOD = { startDate: '2026-09-01', endDate: '2026-11-30' }
const CUSTOM_PERIOD = { startDate: '2026-11-10', endDate: '2026-11-20' }
const ROWS_SINGULAR = 1
const ROWS_LARGE = 1234

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useExportDialog', () => {
  const run = vi.fn()
  const onClose = vi.fn()
  const onResult = vi.fn()
  let resolveRun: (value: unknown) => void

  function setup(scope: ExportScopeProps = { scope: 'statistics', period: PERIOD }) {
    return renderHook(
      (props: { scope: ExportScopeProps }) =>
        useExportDialog({ scope: props.scope, onClose, onResult }),
      { wrapper, initialProps: { scope } }
    )
  }

  function deferRun() {
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRun = resolve
        })
    )
  }

  beforeEach(() => {
    run.mockReset()
    onClose.mockReset()
    onResult.mockReset()
    run.mockResolvedValue({ success: true, data: { path: '/x.csv', rows: 2 } })
    vi.stubGlobal('electronAPI', { export: { run } })
  })

  it('defaults to journal with names unchecked', () => {
    const { result } = setup()
    expect(result.current.kind).toBe('journal')
    expect(result.current.includeNames).toBe(false)
    expect(result.current.canIncludeNames).toBe(true)
  })

  it('selecting an aggregated kind unchecks and disables names', () => {
    const { result } = setup()
    act(() => result.current.onIncludeNamesChange(null, true))
    expect(result.current.includeNames).toBe(true)
    act(() => result.current.onKindChange(null, 'visitsByDay'))
    expect(result.current.kind).toBe('visitsByDay')
    expect(result.current.includeNames).toBe(false)
    expect(result.current.canIncludeNames).toBe(false)
    act(() => result.current.onKindChange(null, 'journal'))
    expect(result.current.includeNames).toBe(false)
    expect(result.current.canIncludeNames).toBe(true)
  })

  it('ignores an unknown kind value', () => {
    const { result } = setup()
    act(() => result.current.onKindChange(null, 'students'))
    expect(result.current.kind).toBe('journal')
  })

  it('submit sends { kind: journal, period, includeNames: false } by default', async () => {
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    expect(run).toHaveBeenCalledWith({ kind: 'journal', period: PERIOD, includeNames: false })
  })

  it('submit with names checked sends includeNames: true', async () => {
    const { result } = setup()
    act(() => result.current.onIncludeNamesChange(null, true))
    act(() => result.current.submit())
    await waitFor(() => expect(run).toHaveBeenCalled())
    expect(run).toHaveBeenCalledWith({ kind: 'journal', period: PERIOD, includeNames: true })
  })

  it('aggregated submit sends includeNames: false', async () => {
    const { result } = setup()
    act(() => result.current.onIncludeNamesChange(null, true))
    act(() => result.current.onKindChange(null, 'visitsByClass'))
    act(() => result.current.submit())
    await waitFor(() => expect(run).toHaveBeenCalled())
    expect(run).toHaveBeenCalledWith({
      kind: 'visitsByClass',
      period: PERIOD,
      includeNames: false
    })
  })

  it("passes the page's current range (custom range) to the request", async () => {
    const { result, rerender } = setup()
    rerender({ scope: { scope: 'statistics', period: CUSTOM_PERIOD } })
    act(() => result.current.submit())
    await waitFor(() => expect(run).toHaveBeenCalled())
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ period: CUSTOM_PERIOD }))
  })

  it('a cancelled result closes the dialog without toast', async () => {
    run.mockResolvedValue({ success: true, data: { cancelled: true } })
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onResult).not.toHaveBeenCalled()
  })

  it('gives the "0 ligne exportée" toast for an empty export', async () => {
    run.mockResolvedValue({ success: true, data: { path: '/x.csv', rows: 0 } })
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('0 ligne exportée', 'success'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses the singular for 1 row and the plural without a thousands separator', async () => {
    run.mockResolvedValueOnce({ success: true, data: { path: '/x.csv', rows: ROWS_SINGULAR } })
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('1 ligne exportée', 'success'))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    run.mockResolvedValueOnce({ success: true, data: { path: '/x.csv', rows: ROWS_LARGE } })
    act(() => result.current.submit())
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('1234 lignes exportées', 'success'))
  })

  it('shows the resolved error toast and keeps the dialog open on IPC failure', async () => {
    run.mockResolvedValue({
      success: false,
      error: 'raw',
      code: ErrorCode.EXPORT_WRITE_FAILED
    })
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1))
    expect(onResult).toHaveBeenCalledWith(expect.not.stringMatching(/^raw$/), 'error')
    expect(onClose).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toMatch(/\S/)
    expect(onResult).toHaveBeenCalledWith(result.current.errorMessage, 'error')
  })

  it('allows a new attempt after a failure', async () => {
    run.mockResolvedValueOnce({ success: false, error: 'boom' })
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.errorMessage).toBe('boom'))
    act(() => result.current.submit())
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('sends exactly one request on a double submit', async () => {
    deferRun()
    const { result } = setup()
    act(() => {
      result.current.submit()
      result.current.submit()
    })
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => resolveRun({ success: true, data: { path: '/x.csv', rows: 1 } }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('refuses to close while the export is pending', async () => {
    deferRun()
    const { result } = setup()
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.isPending).toBe(true))
    act(() => result.current.requestClose())
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => resolveRun({ success: true, data: { cancelled: true } }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('closes on request when idle', () => {
    const { result } = setup()
    act(() => result.current.requestClose())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
