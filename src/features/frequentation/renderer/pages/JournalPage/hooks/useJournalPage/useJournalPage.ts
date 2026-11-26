import { useState } from 'react'
import dayjs from 'dayjs'
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
  const { mutate: updateMutate } = useUpdateFrequentation()
  const activityOptions = buildActivityOptions(allActivities, getLabel)

  function startEditing(entry: JournalEntryViewModel) {
    setEditingEntryState(entry)
    setEditingActivity(entry.activity)
  }

  function closeEditDialog() {
    setEditingEntryState(null)
    setEditingActivity(null)
    setPendingDuplicates([])
  }

  function sendEdit(allowDuplicates: boolean) {
    if (!editingEntry || !editingActivity) {
      return
    }
    updateMutate(
      {
        id: editingEntry.id,
        activity: editingActivity,
        ...(allowDuplicates && { allowDuplicates })
      },
      {
        onSuccess: (data) => {
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
    cancelDuplicates
  } as const
}
