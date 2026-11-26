import { useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useToast } from '@ui/hooks/useToast'
import { useUpdateFrequentation } from '@frequentation/api/useFrequentationMutations'
import { useActivityLabels } from '@frequentation/hooks/useActivityLabels'
import { buildActivityOptions } from '@frequentation/helpers/buildActivityOptions'
import type { JournalEntryViewModel } from '@frequentation/types'
import { isDuplicatesFound } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'
import type { ActivityType } from '@types'

const ISO_DATE_FORMAT = 'YYYY-MM-DD'

function todayIso(): string {
  return dayjs().format(ISO_DATE_FORMAT)
}

export function useJournalPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const [editingEntry, setEditingEntryState] = useState<JournalEntryViewModel | null>(null)
  const [editingActivity, setEditingActivity] = useState<ActivityType | null>(null)

  const [pendingDuplicates, setPendingDuplicates] = useState<DuplicateWarningDto[]>([])

  const { allActivities, getLabel } = useActivityLabels()
  const { mutate: updateMutate, isPending } = useUpdateFrequentation()
  const { toast, show, dismiss } = useToast()
  // Synchronous guards: a double activation before re-render must send once,
  // and a late response must not resurrect a closed edit dialog.
  const inFlightRef = useRef(false)
  const editingIdRef = useRef<number | null>(null)
  const activityOptions = buildActivityOptions(allActivities, getLabel)

  function startEditing(entry: JournalEntryViewModel) {
    editingIdRef.current = entry.id
    setEditingEntryState(entry)
    setEditingActivity(entry.activity)
  }

  function closeEditDialog() {
    editingIdRef.current = null
    setEditingEntryState(null)
    setEditingActivity(null)
    setPendingDuplicates([])
  }

  function sendEdit(allowDuplicates: boolean) {
    if (!editingEntry || !editingActivity || inFlightRef.current) {
      return
    }
    const entryId = editingEntry.id
    inFlightRef.current = true
    updateMutate(
      {
        id: editingEntry.id,
        activity: editingActivity,
        ...(allowDuplicates && { allowDuplicates })
      },
      {
        onSettled: () => {
          inFlightRef.current = false
        },
        onError: (error: Error) => {
          if (editingIdRef.current === entryId) {
            show(error.message, 'error')
          }
        },
        onSuccess: (data) => {
          if (editingIdRef.current !== entryId) {
            return
          }
          if (isDuplicatesFound(data)) {
            setPendingDuplicates(data.duplicates)
            return
          }
          closeEditDialog()
        }
      }
    )
  }

  function submitEdit() {
    sendEdit(false)
  }

  function confirmDuplicates() {
    setPendingDuplicates([])
    sendEdit(true)
  }

  function cancelDuplicates() {
    setPendingDuplicates([])
  }

  return {
    selectedDate,
    setSelectedDate,
    editingEntry,
    editingActivity,
    setEditingActivity,
    startEditing,
    closeEditDialog,
    activityOptions,
    submitEdit,
    getLabel,
    pendingDuplicates,
    confirmDuplicates,
    cancelDuplicates,
    isSaving: isPending,
    toast,
    dismissToast: dismiss
  } as const
}
