import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  SUBMIT_BAR_ATTRIBUTE,
  SUBMIT_BAR_HEIGHT_VAR
} from '../../../containers/JournalEntryFormContainer'
import { useSubmitBarHeight } from '../useSubmitBarHeight'

const BAR_HEIGHT = 86
const TALLER_BAR_HEIGHT = 104
type ObserverCallback = () => void

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

function rectOfHeight(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height,
    top: 0,
    right: 0,
    bottom: height,
    left: 0,
    toJSON: () => ({})
  }
}

function Probe({ barHeight }: { barHeight: number }) {
  const ref = useSubmitBarHeight<HTMLDivElement>()
  return (
    <div ref={ref} data-testid="column">
      <div
        {...{ [SUBMIT_BAR_ATTRIBUTE]: '' }}
        ref={(node) => {
          if (node) {
            node.getBoundingClientRect = () => rectOfHeight(barHeight)
          }
        }}
      />
    </div>
  )
}

describe('useSubmitBarHeight', () => {
  beforeEach(() => {
    capturedCallback = null
    observeSpy.mockClear()
    disconnectSpy.mockClear()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes the measured bar height on the column and tracks its resizes', () => {
    const { rerender } = render(<Probe barHeight={BAR_HEIGHT} />)
    act(() => capturedCallback?.())
    const column = screen.getByTestId('column')
    expect(column.style.getPropertyValue(SUBMIT_BAR_HEIGHT_VAR)).toBe(`${BAR_HEIGHT}px`)
    rerender(<Probe barHeight={TALLER_BAR_HEIGHT} />)
    act(() => capturedCallback?.())
    expect(column.style.getPropertyValue(SUBMIT_BAR_HEIGHT_VAR)).toBe(`${TALLER_BAR_HEIGHT}px`)
  })

  it('leaves the variable unset when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render(<Probe barHeight={BAR_HEIGHT} />)
    expect(screen.getByTestId('column').style.getPropertyValue(SUBMIT_BAR_HEIGHT_VAR)).toBe('')
  })

  it('disconnects and clears the variable on unmount', () => {
    const { unmount } = render(<Probe barHeight={BAR_HEIGHT} />)
    unmount()
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
