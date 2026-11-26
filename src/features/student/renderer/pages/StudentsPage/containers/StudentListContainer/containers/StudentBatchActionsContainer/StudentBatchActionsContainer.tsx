import { useTranslation } from 'react-i18next'
import type { AnonymizeStudentsResult } from '@student-shared'
import { Button } from '@ui/components/Button'
import { ConfirmDialog } from '@ui/components/ConfirmDialog'
import { AnonymizeStudentsDialogPresenter } from '../../presenters/AnonymizeStudentsDialogPresenter'
import { useStudentBatchActions } from './hooks/useStudentBatchActions'
import {
  NO_SELECTION,
  BatchActionsStrip,
  BatchCountLabel
} from './StudentBatchActionsContainer.styles'

interface StudentBatchActionsContainerProps {
  selectedIds: number[]
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onAfterDelete: () => void
  withoutVisitsCount: number
  onAfterAnonymize: (result: AnonymizeStudentsResult) => void
}

export function StudentBatchActionsContainer({
  selectedIds,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onAfterDelete,
  withoutVisitsCount,
  onAfterAnonymize
}: StudentBatchActionsContainerProps) {
  const { t: tStudent } = useTranslation('student')
  const {
    showConfirm,
    isPending,
    hasSelection,
    selectToggleLabel,
    batchDeleteLabel,
    confirmTitle,
    confirmMessage,
    confirmButtonLabel,
    handleSelectToggle,
    anonymize,
    handleDeleteClick,
    handleAnonymizeClick,
    handleConfirmDelete,
    closeConfirm
  } = useStudentBatchActions({
    selectedIds,
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onAfterDelete,
    onAfterAnonymize
  })

  return (
    <>
      <BatchActionsStrip>
        <Button
          variant="secondary"
          onClick={handleSelectToggle}
          disabled={totalCount === NO_SELECTION || isPending}
        >
          {selectToggleLabel}
        </Button>
        <Button
          variant="secondary"
          disabled={!hasSelection || isPending}
          onClick={handleAnonymizeClick}
        >
          {tStudent('anonymize.batchAction')}
        </Button>
        <Button variant="danger" disabled={!hasSelection || isPending} onClick={handleDeleteClick}>
          {batchDeleteLabel}
        </Button>
        {hasSelection ? (
          <BatchCountLabel variant="body2">
            {tStudent('batch.selectedCount', { count: selectedCount })}
          </BatchCountLabel>
        ) : null}
      </BatchActionsStrip>

      <ConfirmDialog
        open={showConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmButtonLabel}
        destructive
        onConfirm={handleConfirmDelete}
        onClose={closeConfirm}
      />

      <AnonymizeStudentsDialogPresenter
        open={anonymize.isOpen}
        count={anonymize.pendingIds.length}
        withoutVisitsCount={withoutVisitsCount}
        onConfirm={anonymize.confirm}
        onClose={anonymize.close}
        isPending={anonymize.isPending}
        errorMessage={anonymize.errorMessage}
      />
    </>
  )
}
