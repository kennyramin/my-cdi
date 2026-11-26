import { useState } from 'react'

interface SelectionState {
  scopeKey: string
  ids: number[]
}

const EMPTY_IDS: number[] = []

export function useJournalEntrySelection(scopeKey: string) {
  const [selection, setSelection] = useState<SelectionState>({ scopeKey, ids: EMPTY_IDS })

  // Adjust state while rendering: a selection belongs to one scope; drop it when the scope changes.
  if (selection.scopeKey !== scopeKey) {
    setSelection({ scopeKey, ids: EMPTY_IDS })
  }

  const selectedIds = selection.scopeKey === scopeKey ? selection.ids : EMPTY_IDS

  function toggle(id: number) {
    setSelection((prev) => {
      const base = prev.scopeKey === scopeKey ? prev.ids : EMPTY_IDS
      const ids = base.includes(id) ? base.filter((sid) => sid !== id) : [...base, id]
      return { scopeKey, ids }
    })
  }

  function selectAll(ids: number[]) {
    setSelection({ scopeKey, ids })
  }

  function clearSelection() {
    setSelection({ scopeKey, ids: EMPTY_IDS })
  }

  function isSelected(id: number) {
    return selectedIds.includes(id)
  }

  const selectedCount = selectedIds.length

  return {
    selectedIds,
    selectedCount,
    toggle,
    selectAll,
    clearSelection,
    isSelected
  } as const
}
