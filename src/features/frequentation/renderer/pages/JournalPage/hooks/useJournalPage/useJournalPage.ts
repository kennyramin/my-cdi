import { useRef, useState } from 'react'
import { formatLocalDate, isFutureLocalDateTime } from '@lib/localDateTime'
import { useStudentList } from '@student/api/useStudentQueries'
import type { AutocompleteOption } from '@ui/components/Autocomplete'
import { useUpdateFrequentation } from '@frequentation/api/useFrequentationMutations'
import { useActivityLabels } from '@frequentation/hooks/useActivityLabels'
import { buildActivityOptions } from '@frequentation/helpers/buildActivityOptions'
import type { JournalEntryViewModel } from '@frequentation/types'
import { isDuplicatesFound } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'
import type { ActivityType } from '@types'

const SECONDS_SUFFIX = ':00'
const DATE_END = 10
const TIME_START = 11
const TIME_END = 16

interface EditDraft {
  date: string
  time: string
  studentId: number | null
  activity: ActivityType
}

function todayIso(): string {
  return formatLocalDate(new Date())
}

function buildDraft(entry: JournalEntryViewModel): EditDraft {
  return {
    date: entry.startsAt.slice(0, DATE_END),
    time: entry.startsAt.slice(TIME_START, TIME_END),
    studentId: entry.student.id,
    activity: entry.activity
  }
}

export function useJournalPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const [editingEntry, setEditingEntryState] = useState<JournalEntryViewModel | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editStudentInputValue, setEditStudentInputValue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [pendingEditDuplicates, setPendingEditDuplicates] = useState<DuplicateWarningDto[]>([])

  const { allActivities, getLabel } = useActivityLabels()
  const { mutate: updateMutate, isPending } = useUpdateFrequentation()
  const { data: students } = useStudentList()
  // Synchronous guards: a double activation before re-render must send once,
  // and a late response must not resurrect a closed edit dialog.
  const inFlightRef = useRef(false)
  const editingIdRef = useRef<number | null>(null)
  const activityOptions = buildActivityOptions(allActivities, getLabel)

  const studentOptions = (students ?? []).map((student) => ({
    value: student.id,
    label: student.displayName,
    badge: student.classe
  }))

  const isEditAnonymized = editingEntry?.isAnonymized ?? false
  const hasDateAndTime = Boolean(editDraft?.date) && Boolean(editDraft?.time)
  const isEditFuture =
    editDraft !== null &&
    hasDateAndTime &&
    isFutureLocalDateTime(`${editDraft.date}T${editDraft.time}${SECONDS_SUFFIX}`, new Date())
  const hasStudent = isEditAnonymized || editDraft?.studentId != null
  const canSubmitEdit = editDraft !== null && hasDateAndTime && !isEditFuture && hasStudent

  function startEditing(entry: JournalEntryViewModel) {
    editingIdRef.current = entry.id
    setEditingEntryState(entry)
    setEditDraft(buildDraft(entry))
    setEditStudentInputValue(entry.student.displayName)
    setEditError(null)
  }

  function closeEditDialog() {
    editingIdRef.current = null
    setEditingEntryState(null)
    setEditDraft(null)
    setEditStudentInputValue('')
    setEditError(null)
    setPendingEditDuplicates([])
  }

  function updateDraft(patch: Partial<EditDraft>) {
    setEditDraft((current) => (current ? { ...current, ...patch } : current))
    setEditError(null)
  }

  function setEditDate(date: string) {
    updateDraft({ date })
  }

  function setEditTime(time: string) {
    updateDraft({ time })
  }

  function setEditingActivity(activity: ActivityType) {
    updateDraft({ activity })
  }

  function setEditStudent(option: AutocompleteOption<number>) {
    updateDraft({ studentId: option.value })
    setEditStudentInputValue(option.label)
  }

  function buildPayload(entry: JournalEntryViewModel, draft: EditDraft, allowDuplicates: boolean) {
    const startsAt = `${draft.date}T${draft.time}${SECONDS_SUFFIX}`
    const startsAtChanged = `${draft.date}T${draft.time}` !== entry.startsAt.slice(0, TIME_END)
    const { studentId } = draft
    const studentChange =
      !entry.isAnonymized && studentId !== null && studentId !== entry.student.id
        ? { studentId }
        : {}
    return {
      id: entry.id,
      activity: draft.activity,
      ...(startsAtChanged && { startsAt }),
      ...studentChange,
      ...(allowDuplicates && { allowDuplicates })
    }
  }

  function sendEdit(allowDuplicates: boolean) {
    if (!editingEntry || !editDraft || !canSubmitEdit || inFlightRef.current) {
      return
    }
    const entryId = editingEntry.id
    inFlightRef.current = true
    setEditError(null)
    updateMutate(buildPayload(editingEntry, editDraft, allowDuplicates), {
      onSettled: () => {
        inFlightRef.current = false
      },
      onError: (error: Error) => {
        if (editingIdRef.current === entryId) {
          setEditError(error.message)
        }
      },
      onSuccess: (data) => {
        if (editingIdRef.current !== entryId) {
          return
        }
        if (isDuplicatesFound(data)) {
          setPendingEditDuplicates(data.duplicates)
          return
        }
        closeEditDialog()
      }
    })
  }

  function submitEdit() {
    sendEdit(false)
  }

  function confirmEditDuplicates() {
    setPendingEditDuplicates([])
    sendEdit(true)
  }

  function cancelEditDuplicates() {
    setPendingEditDuplicates([])
  }

  return {
    selectedDate,
    setSelectedDate,
    editingEntry,
    editDraft,
    editingActivity: editDraft?.activity ?? null,
    setEditingActivity,
    setEditDate,
    setEditTime,
    setEditStudent,
    studentOptions,
    editStudentInputValue,
    setEditStudentInputValue,
    isEditAnonymized,
    isEditFuture,
    canSubmitEdit,
    editError,
    startEditing,
    closeEditDialog,
    activityOptions,
    submitEdit,
    getLabel,
    pendingEditDuplicates,
    confirmEditDuplicates,
    cancelEditDuplicates,
    isSaving: isPending
  } as const
}
