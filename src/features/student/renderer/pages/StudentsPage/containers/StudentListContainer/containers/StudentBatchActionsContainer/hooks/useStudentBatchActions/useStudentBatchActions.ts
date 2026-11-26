import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnonymizeStudentsResult } from '@student-shared'
import { useBatchDelete } from '../useBatchDelete'
import { useAnonymizeDialog } from '../../../../hooks/useAnonymizeDialog'

interface UseStudentBatchActionsOptions {
  selectedIds: number[]
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onAfterDelete: () => void
  onAfterAnonymize: (result: AnonymizeStudentsResult) => void
}

const NO_SELECTION = 0

export function useStudentBatchActions(options: UseStudentBatchActionsOptions) {
  const {
    selectedIds,
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onAfterDelete,
    onAfterAnonymize
  } = options
  const { t: tCommon } = useTranslation('common')
  const { t: tStudent } = useTranslation('student')
  const [showConfirm, setShowConfirm] = useState(false)

  const { mutate: batchDelete, isPending } = useBatchDelete({
    onSuccess: () => {
      onAfterDelete()
      setShowConfirm(false)
    }
  })

  const anonymize = useAnonymizeDialog({ onSuccess: onAfterAnonymize })

  const isAllSelected = selectedCount === totalCount && totalCount > NO_SELECTION
  const hasSelection = selectedCount > NO_SELECTION

  function handleSelectToggle() {
    if (isAllSelected) {
      onClearSelection()
      return
    }
    onSelectAll()
  }

  function handleDeleteClick() {
    if (hasSelection) {
      setShowConfirm(true)
    }
  }

  function handleAnonymizeClick() {
    if (hasSelection) {
      anonymize.openFor(selectedIds)
    }
  }

  function handleConfirmDelete() {
    batchDelete(selectedIds)
  }

  function closeConfirm() {
    setShowConfirm(false)
  }

  const selectToggleLabel = isAllSelected ? tCommon('app.deselectAll') : tCommon('app.selectAll')

  return {
    showConfirm,
    isPending: isPending || anonymize.isPending,
    anonymize,
    isAllSelected,
    hasSelection,
    selectToggleLabel,
    batchDeleteLabel: tCommon('app.batchDelete'),
    confirmTitle: tCommon('app.confirmDelete'),
    confirmMessage: tStudent('deleteConfirm', { count: selectedCount }),
    confirmButtonLabel: tCommon('app.delete'),
    handleSelectToggle,
    handleDeleteClick,
    handleAnonymizeClick,
    handleConfirmDelete,
    closeConfirm
  } as const
}
