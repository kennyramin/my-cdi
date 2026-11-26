import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useToast } from '@ui/hooks/useToast'
import { useCreateFrequentationBatch } from '@frequentation/api/useFrequentationMutations'
import { useActivityLabels } from '@frequentation/hooks/useActivityLabels'
import { useStudentList } from '@student/api/useStudentQueries'
import { buildActivityOptions } from '@frequentation/helpers/buildActivityOptions'
import { isDuplicatesFound } from '@frequentation-shared'
import type { CreateFrequentationBatchDto, DuplicateWarningDto } from '@frequentation-shared'
import { ActivityType } from '@types'
import { isFutureLocalDate, isFutureLocalDateTime } from '@lib/localDateTime'
import { journalEntryFormSchema } from '../../validations/journalEntryFormSchema'
import { mapFormToBatchDto } from '../../helpers/mapFormToBatchDto'
import type { JournalEntryFormData } from '../../types/JournalEntryFormData'

interface UseJournalEntryFormOptions {
  selectedDate: string
  onSubmitted?: () => void
}

const TIME_FORMAT = 'HH:mm'
const SECONDS_SUFFIX = ':00'
const NONE_CREATED = 0

interface PendingDuplicates {
  dto: CreateFrequentationBatchDto
  duplicates: DuplicateWarningDto[]
}

function buildDefaultTime(): string {
  return dayjs().format(TIME_FORMAT)
}

function buildDefaultValues(): JournalEntryFormData {
  return {
    studentIds: [],
    activity: ActivityType.WORK,
    time: buildDefaultTime()
  }
}

export function useJournalEntryForm({ selectedDate, onSubmitted }: UseJournalEntryFormOptions) {
  const { t } = useTranslation('frequentation')
  const { mutate, isPending } = useCreateFrequentationBatch()
  const { allActivities, getLabel } = useActivityLabels()
  const { data: students, isLoading: isStudentLoading } = useStudentList()
  const { toast, show, dismiss } = useToast()
  const [studentInputValue, setStudentInputValue] = useState('')
  const [pending, setPending] = useState<PendingDuplicates | null>(null)
  // Source of truth for confirm: a double activation before re-render must send once.
  const pendingRef = useRef<PendingDuplicates | null>(null)

  const form = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntryFormSchema),
    mode: 'onChange',
    defaultValues: buildDefaultValues()
  })

  const activityOptions = buildActivityOptions(allActivities, getLabel)

  const studentOptions = (students ?? []).map((student) => ({
    id: student.id,
    displayName: student.displayName,
    classe: student.classe
  }))

  const isFutureDate = isFutureLocalDate(selectedDate, new Date())

  function handleSubmit(values: JournalEntryFormData) {
    if (isFutureLocalDateTime(`${selectedDate}T${values.time}${SECONDS_SUFFIX}`, new Date())) {
      show(t('form.futureNotAllowed'), 'error')
      return
    }
    send(mapFormToBatchDto(values, selectedDate))
  }

  function storePending(next: PendingDuplicates | null) {
    pendingRef.current = next
    setPending(next)
  }

  function reportBatchErrors(created: number, failed: number) {
    if (created === NONE_CREATED) {
      show(t('form.allFailed', { count: failed }), 'error')
      return
    }
    form.reset(buildDefaultValues())
    show(t('form.partialSuccess', { created, failed }), 'warning')
    if (onSubmitted) {
      onSubmitted()
    }
  }

  function send(dto: CreateFrequentationBatchDto) {
    mutate(dto, {
      onSuccess: (data) => {
        if (isDuplicatesFound(data)) {
          storePending({ dto, duplicates: data.duplicates })
          return
        }
        if (data.errors.length > NONE_CREATED) {
          reportBatchErrors(data.created, data.errors.length)
          return
        }
        form.reset(buildDefaultValues())
        show(t('form.successMessage'))
        if (onSubmitted) {
          onSubmitted()
        }
      },
      onError: (error: Error) => {
        show(error.message, 'error')
      }
    })
  }

  function confirmDuplicates() {
    const current = pendingRef.current
    if (current === null) {
      return
    }
    storePending(null)
    send({ ...current.dto, allowDuplicates: true })
  }

  function cancelDuplicates() {
    storePending(null)
  }

  function handleStudentSelect(currentIds: number[], nextId: number) {
    if (currentIds.includes(nextId)) {
      return
    }
    setStudentInputValue('')
    form.setValue('studentIds', [...currentIds, nextId], { shouldValidate: true })
  }

  function handleStudentRemove(currentIds: number[], idToRemove: number) {
    form.setValue(
      'studentIds',
      currentIds.filter((id) => id !== idToRemove),
      { shouldValidate: true }
    )
  }

  return {
    form,
    handleSubmit,
    activityOptions,
    studentOptions,
    studentInputValue,
    setStudentInputValue,
    handleStudentSelect,
    handleStudentRemove,
    isStudentLoading,
    isFutureDate,
    isSubmitting: isPending,
    pendingDuplicates: pending?.duplicates ?? [],
    confirmDuplicates,
    cancelDuplicates,
    getActivityLabel: getLabel,
    toast,
    dismissToast: dismiss
  } as const
}
