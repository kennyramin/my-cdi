import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { CalendarCell } from '../../helpers/buildCalendarMonth'
import { resolveTabbableDay } from '../../helpers/resolveTabbableDay'
import { shiftDayByKey } from '../../helpers/shiftDayByKey'

interface UseCalendarKeyboardNavigationResult {
  tabbableIso: string
  handleDayFocus: (iso: string) => void
  handleDayKeyDown: (event: KeyboardEvent<HTMLButtonElement>, iso: string) => void
}

export function useCalendarKeyboardNavigation(
  cells: CalendarCell[]
): UseCalendarKeyboardNavigationResult {
  const [focusedIso, setFocusedIso] = useState<string | null>(null)
  const tabbableIso = resolveTabbableDay(cells, focusedIso)

  function handleDayFocus(iso: string) {
    setFocusedIso(iso)
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return
    }
    const next = shiftDayByKey(iso, event.key)
    if (next === null || !cells.some((cell) => cell.iso === next)) {
      return
    }
    event.preventDefault()
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-iso="${next}"]`)
      ?.focus()
  }

  return { tabbableIso, handleDayFocus, handleDayKeyDown }
}
