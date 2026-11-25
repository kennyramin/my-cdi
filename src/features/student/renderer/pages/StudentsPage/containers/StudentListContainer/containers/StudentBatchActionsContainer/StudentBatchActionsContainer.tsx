import { useTranslation } from 'react-i18next'
import { Button } from '@ui/components/Button'
import { ConfirmDialog } from '@ui/components/ConfirmDialog'
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
}

export function StudentBatchActionsContainer({
  selectedIds,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onAfterDelete
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
    handleDeleteClick,
    handleConfirmDelete,
    closeConfirm
  } = useStudentBatchActions({
    selectedIds,
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onAfterDelete
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
    </>
  )
}
