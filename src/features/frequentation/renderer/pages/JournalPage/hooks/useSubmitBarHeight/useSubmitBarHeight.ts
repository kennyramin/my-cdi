import { useEffect, useState } from 'react'
import {
  SUBMIT_BAR_ATTRIBUTE,
  SUBMIT_BAR_HEIGHT_VAR
} from '../../containers/JournalEntryFormContainer'

/**
 * Publishes the real height of the sticky submit bar found inside the returned column ref as a CSS
 * custom property on that column, so `scroll-padding-bottom` tracks the bar even when it grows
 * (wrapped helper text, larger fonts). Without ResizeObserver the CSS fallback applies.
 */
export function useSubmitBarHeight<T extends HTMLElement>() {
  const [column, setColumn] = useState<T | null>(null)

  useEffect(() => {
    const bar = column?.querySelector(`[${SUBMIT_BAR_ATTRIBUTE}]`)
    if (!column || !bar || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const publish = () => {
      column.style.setProperty(SUBMIT_BAR_HEIGHT_VAR, `${bar.getBoundingClientRect().height}px`)
    }
    const observer = new ResizeObserver(publish)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      column.style.removeProperty(SUBMIT_BAR_HEIGHT_VAR)
    }
  }, [column])

  return setColumn
}
