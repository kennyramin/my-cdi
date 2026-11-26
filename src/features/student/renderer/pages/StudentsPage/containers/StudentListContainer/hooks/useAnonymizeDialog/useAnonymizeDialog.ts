import { useState } from 'react'
import { useAnonymizeStudents } from '@student/api/useStudentMutations'
import type { AnonymizeStudentsResult } from '@student-shared'

interface UseAnonymizeDialogOptions {
  onSuccess: (result: AnonymizeStudentsResult) => void
}

const NO_IDS: number[] = []

export function useAnonymizeDialog({ onSuccess }: UseAnonymizeDialogOptions) {
  const [pendingIds, setPendingIds] = useState<number[] | null>(null)
  const {
    mutate: anonymize,
    reset,
    isPending,
    error
  } = useAnonymizeStudents({
    onSuccess: (result) => {
      setPendingIds(null)
      onSuccess(result)
    }
  })

  function openFor(ids: number[]) {
    if (isPending) {
      return
    }
    reset()
    setPendingIds(ids)
  }

  function confirm() {
    if (pendingIds !== null && !isPending) {
      anonymize(pendingIds)
    }
  }

  function close() {
    if (isPending) {
      return
    }
    reset()
    setPendingIds(null)
  }

  return {
    isOpen: pendingIds !== null,
    pendingIds: pendingIds ?? NO_IDS,
    isPending,
    errorMessage: error?.message ?? null,
    openFor,
    confirm,
    close
  } as const
}
