import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useElementWidth } from '../useElementWidth'

const FALLBACK = 700
const WIDE = 1200
type ObserverCallback = (entries: { contentRect: { width: number } }[]) => void

let capturedCallback: ObserverCallback | null = null
const observeSpy = vi.fn()
const disconnectSpy = vi.fn()

class FakeResizeObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback
  }
  observe = observeSpy
  disconnect = disconnectSpy
}

function triggerWidth(width: number) {
  act(() => {
    capturedCallback?.([{ contentRect: { width } }])
  })
}

function Probe() {
  const { ref, width } = useElementWidth<HTMLDivElement>(FALLBACK)
  return <div ref={ref}>{width}</div>
}

describe('useElementWidth', () => {
  beforeEach(() => {
    capturedCallback = null
    observeSpy.mockClear()
    disconnectSpy.mockClear()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the observed width', () => {
    render(<Probe />)
    triggerWidth(WIDE)
    expect(screen.getByText(String(WIDE))).toBeInTheDocument()
  })

  it('keeps the fallback while the measured width is 0', () => {
    render(<Probe />)
    triggerWidth(0)
    expect(screen.getByText(String(FALLBACK))).toBeInTheDocument()
  })

  it('falls back when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render(<Probe />)
    expect(screen.getByText(String(FALLBACK))).toBeInTheDocument()
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<Probe />)
    unmount()
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
