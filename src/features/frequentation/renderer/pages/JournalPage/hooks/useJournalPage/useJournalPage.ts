import { useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLocalDate } from '@lib/localDateTime'
import { useStudentList } from '@student/api/useStudentQueries'
import type { AutocompleteOption } from '@ui/components/Autocomplete'
import { useUpdateFrequentation } from '@frequentation/api/useFrequentationMutations'
import { useActivityLabels } from '@frequentation/hooks/useActivityLabels'
import { buildActivityOptions } from '@frequentation/helpers/buildActivityOptions'
import type { JournalEntryViewModel } from '@frequentation/types'
import { isDuplicatesFound } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'
import type { ActivityType } from '@types'
import { buildEditDraft } from '../../helpers/buildEditDraft'
import { buildEditPayload } from '../../helpers/buildEditPayload'
import { getEditDateTimeIssue } from '../../helpers/getEditDateTimeIssue'
import type { EditDraft } from '../../types/EditDraft'

function todayIso(): string {
  return formatLocalDate(new Date())
}

export function useJournalPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const [editingEntry, setEditingEntryState] = useState<JournalEntryViewModel | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editStudentInputValue, setEditStudentInputValue] = useState('')
  const [editStudentLabel, setEditStudentLabel] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [pendingEditDuplicates, setPendingEditDuplicates] = useState<DuplicateWarningDto[]>([])

  const { t } = useTranslation('frequentation')
  const idBase = useId()
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
  // Evaluated from the clock at each render; submit re-checks it (see sendEdit).
  const now = new Date()
  const editDateTimeIssue = editDraft
    ? getEditDateTimeIssue(editDraft.date, editDraft.time, now)
    : null
  const isEditFuture = editDateTimeIssue === 'future'
  const isEditStudentUnselected = !isEditAnonymized && editStudentInputValue !== editStudentLabel
  const canSubmitEdit = editDraft !== null && editDateTimeIssue === null && !isEditStudentUnselected
  const editDateTimeMessage = resolveDateTimeMessage(editDateTimeIssue)
  const editStudentMessage = isEditStudentUnselected ? t('edit.studentRequired') : null
  const editFieldIds = {
    dateTimeHelper: `${idBase}-datetime-helper`,
    studentInput: `${idBase}-student`,
    studentHelper: `${idBase}-student-helper`
  }

  function resolveDateTimeMessage(issue: ReturnType<typeof getEditDateTimeIssue>): string | null {
    if (issue === 'future') {
      return t('form.futureNotAllowed')
    }
    return issue === 'required' ? t('edit.dateTimeRequired') : null
  }

  function startEditing(entry: JournalEntryViewModel) {
    editingIdRef.current = entry.id
    setEditingEntryState(entry)
    setEditDraft(buildEditDraft(entry))
    setEditStudentInputValue(entry.student.displayName)
    setEditStudentLabel(entry.student.displayName)
    setEditError(null)
  }

  function closeEditDialog() {
    editingIdRef.current = null
    setEditingEntryState(null)
    setEditDraft(null)
    setEditStudentInputValue('')
    setEditStudentLabel('')
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
    setEditStudentLabel(option.label)
  }

  function handleEditDateChange(event: ChangeEvent<HTMLInputElement>) {
    setEditDate(event.target.value)
  }

  function handleEditTimeChange(event: ChangeEvent<HTMLInputElement>) {
    setEditTime(event.target.value)
  }

  function sendEdit(allowDuplicates: boolean) {
    if (!editingEntry || !editDraft || !canSubmitEdit || inFlightRef.current) {
      return
    }
    // The clock may have moved since the last render (dialog left open across midnight).
    if (getEditDateTimeIssue(editDraft.date, editDraft.time, new Date()) !== null) {
      return
    }
    const entryId = editingEntry.id
    inFlightRef.current = true
    setEditError(null)
    updateMutate(buildEditPayload(editingEntry, editDraft, allowDuplicates), {
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
    handleEditDateChange,
    handleEditTimeChange,
    setEditStudent,
    studentOptions,
    editStudentInputValue,
    setEditStudentInputValue,
    isEditAnonymized,
    isEditFuture,
    editDateTimeMessage,
    editStudentMessage,
    editMaxDate: formatLocalDate(now),
    editFieldIds,
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
