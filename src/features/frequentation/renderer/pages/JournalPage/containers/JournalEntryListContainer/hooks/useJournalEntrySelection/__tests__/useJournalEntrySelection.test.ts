import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJournalEntrySelection } from '../useJournalEntrySelection'

const ID_FIRST = 1
const ID_SECOND = 2
const ID_THIRD = 3
const ALL_IDS = [ID_FIRST, ID_SECOND, ID_THIRD]
const ALL_IDS_COUNT = 3
const DATE_FIRST = '2026-11-24'
const DATE_SECOND = '2026-11-25'

describe('useJournalEntrySelection', () => {
  it('toggles entry selection', () => {
    const { result } = renderHook(() => useJournalEntrySelection(DATE_FIRST))
    act(() => result.current.toggle(ID_FIRST))
    expect(result.current.isSelected(ID_FIRST)).toBe(true)
    act(() => result.current.toggle(ID_FIRST))
    expect(result.current.isSelected(ID_FIRST)).toBe(false)
  })

  it('selects all and clears selection', () => {
    const { result } = renderHook(() => useJournalEntrySelection(DATE_FIRST))
    act(() => result.current.selectAll(ALL_IDS))
    expect(result.current.selectedCount).toBe(ALL_IDS_COUNT)
    act(() => result.current.clearSelection())
    expect(result.current.selectedCount).toBe(0)
  })

  it('clears the selection when the scope key changes', () => {
    const { result, rerender } = renderHook(({ scopeKey }) => useJournalEntrySelection(scopeKey), {
      initialProps: { scopeKey: DATE_FIRST }
    })
    act(() => result.current.selectAll(ALL_IDS))
    rerender({ scopeKey: DATE_SECOND })
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.selectedCount).toBe(0)
    act(() => result.current.toggle(ID_FIRST))
    expect(result.current.selectedIds).toEqual([ID_FIRST])
  })

  it('does not restore a selection when returning to a previous date', () => {
    const { result, rerender } = renderHook(({ scopeKey }) => useJournalEntrySelection(scopeKey), {
      initialProps: { scopeKey: DATE_FIRST }
    })
    act(() => result.current.selectAll(ALL_IDS))
    rerender({ scopeKey: DATE_SECOND })
    rerender({ scopeKey: DATE_FIRST })
    expect(result.current.selectedCount).toBe(0)
  })
})
