import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExportButton } from '../useExportButton'

describe('useExportButton', () => {
  it('starts closed and never opened', () => {
    const { result } = renderHook(() => useExportButton())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.hasBeenOpened).toBe(false)
  })

  it('opens with a new session each time so the dialog starts fresh', () => {
    const { result } = renderHook(() => useExportButton())
    act(() => result.current.openDialog())
    const first = result.current.session
    expect(result.current.isOpen).toBe(true)
    expect(result.current.hasBeenOpened).toBe(true)
    act(() => result.current.closeDialog())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.session).toBe(first)
    act(() => result.current.openDialog())
    expect(result.current.session).not.toBe(first)
  })

  it('refocuses the trigger on close', () => {
    const { result } = renderHook(() => useExportButton())
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    result.current.triggerRef.current = trigger
    act(() => result.current.openDialog())
    act(() => result.current.closeDialog())
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
