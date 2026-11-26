import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader } from '@ui/components/Loader'
import { Toast } from '@ui/components/Toast'
import { ConfirmDialog } from '@ui/components/ConfirmDialog'
import { useToast } from '@ui/hooks/useToast'
import { useStudentListData } from './hooks/useStudentListData'
import { useStudentSelection } from './hooks/useStudentSelection'
import { useAnonymizeDialog } from './hooks/useAnonymizeDialog'
import { useDeleteStudent } from '@student/api/useStudentMutations'
import { buildStudentInitials } from '@student/helpers/studentFormatters'
import { StudentTablePresenter } from './presenters/StudentTablePresenter'
import { StudentTableRowPresenter } from './presenters/StudentTableRowPresenter'
import { buildNextSortConfig } from './helpers/buildNextSortConfig'
import { intersectVisibleSelection } from './helpers/intersectVisibleSelection'
import { getHeaderSortState } from './helpers/getHeaderSortState'
import { SortableHeaderCellPresenter } from './presenters/SortableHeaderCellPresenter'
import { AnonymizeStudentsDialogPresenter } from './presenters/AnonymizeStudentsDialogPresenter'
import { StudentListToolbarPresenter } from './presenters/StudentListToolbarPresenter'
import { StudentBatchActionsContainer } from './containers/StudentBatchActionsContainer'
import {
  CHECKBOX_CELL_STYLE,
  ACTIONS_CELL_STYLE,
  VISITS_CELL_STYLE,
  StudentListLayout
} from './StudentListContainer.styles'
import type { StudentListContainerProps } from './types/StudentListContainerProps'
import type { AnonymizeStudentsResult } from '@student-shared'
import type { StudentSortField, StudentViewModel } from '@student/types'

const SORTABLE_FIELDS: readonly StudentSortField[] = [
  'nom',
  'prenom',
  'classe',
  'ine',
  'visitCount'
]

const VISITS_FIELD: StudentSortField = 'visitCount'
const NO_VISITS = 0

function countWithoutVisits(students: StudentViewModel[], ids: number[]): number {
  return students.filter((student) => ids.includes(student.id) && student.visitCount === NO_VISITS)
    .length
}

export function StudentListContainer({ onEditStudent, onAddStudent }: StudentListContainerProps) {
  const { t: tCommon } = useTranslation('common')
  const { t: tStudent } = useTranslation('student')
  const { filteredStudents, searchTerm, setSearchTerm, sortConfig, setSortConfig, isLoading } =
    useStudentListData()

  const { selectedIds, toggle, selectAll, clearSelection } = useStudentSelection()
  const { toast, show, dismiss } = useToast()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const { mutate: deleteStudent } = useDeleteStudent({
    onSuccess: () => {
      show(tStudent('deleteSuccess'))
    }
  })

  function showAnonymizeSuccess({ anonymized, deletedWithoutVisits }: AnonymizeStudentsResult) {
    show(tStudent('anonymize.success', { anonymized, deletedWithoutVisits }))
  }

  const rowAnonymize = useAnonymizeDialog({
    onSuccess: showAnonymizeSuccess
  })

  const visibleSelectedIds = intersectVisibleSelection(
    selectedIds,
    filteredStudents.map((student) => student.id)
  )

  const selectedWithoutVisitsCount = countWithoutVisits(filteredStudents, visibleSelectedIds)
  const rowWithoutVisitsCount = countWithoutVisits(filteredStudents, rowAnonymize.pendingIds)

  function handleSelectAll() {
    selectAll(filteredStudents.map((student) => student.id))
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value)
  }

  function handleAnonymizeSuccess(result: AnonymizeStudentsResult) {
    clearSelection()
    showAnonymizeSuccess(result)
  }

  function handleDeleteClick(id: number) {
    setPendingDeleteId(id)
  }

  function handleConfirmDelete() {
    if (pendingDeleteId !== null) {
      deleteStudent({ id: pendingDeleteId })
      setPendingDeleteId(null)
    }
  }

  function closeConfirmDelete() {
    setPendingDeleteId(null)
  }

  function buildRowNodes(students: StudentViewModel[]): ReactNode[] {
    return students.map((student) => (
      <StudentTableRowPresenter
        key={student.id}
        student={student}
        initials={buildStudentInitials(student.prenom, student.nom)}
        selected={selectedIds.includes(student.id)}
        onCheckboxChange={() => {
          toggle(student.id)
        }}
        onCheckboxClick={(event) => {
          event.stopPropagation()
        }}
        onEditClick={(event) => {
          event.stopPropagation()
          onEditStudent(student)
        }}
        onAnonymizeClick={(event) => {
          event.stopPropagation()
          rowAnonymize.openFor([student.id])
        }}
        onDeleteClick={(event) => {
          event.stopPropagation()
          handleDeleteClick(student.id)
        }}
      />
    ))
  }

  function buildSortHeaderNode(field: StudentSortField): ReactNode {
    return (
      <SortableHeaderCellPresenter
        key={field}
        label={tStudent(`fields.${field}`)}
        style={field === VISITS_FIELD ? VISITS_CELL_STYLE : undefined}
        sortState={getHeaderSortState(sortConfig, field)}
        onSort={() => {
          setSortConfig(buildNextSortConfig(sortConfig, field))
        }}
      />
    )
  }

  function buildHeaderNodes(): ReactNode[] {
    const sortNodes: ReactNode[] = SORTABLE_FIELDS.map(buildSortHeaderNode)
    return [
      <th key="checkbox" style={CHECKBOX_CELL_STYLE} />,
      ...sortNodes,
      <th key="actions" style={ACTIONS_CELL_STYLE}>
        {tStudent('fields.actions')}
      </th>
    ]
  }

  if (isLoading) {
    return <Loader message={tCommon('app.loading')} />
  }

  return (
    <StudentListLayout>
      <StudentListToolbarPresenter
        searchTerm={searchTerm}
        totalCount={filteredStudents.length}
        onSearchChange={handleSearchChange}
        onAddStudent={onAddStudent}
      />

      <StudentBatchActionsContainer
        selectedIds={visibleSelectedIds}
        selectedCount={visibleSelectedIds.length}
        totalCount={filteredStudents.length}
        onSelectAll={handleSelectAll}
        onClearSelection={clearSelection}
        onAfterDelete={clearSelection}
        withoutVisitsCount={selectedWithoutVisitsCount}
        onAfterAnonymize={handleAnonymizeSuccess}
      />

      <StudentTablePresenter
        headerNodes={buildHeaderNodes()}
        rowNodes={buildRowNodes(filteredStudents)}
        countLabel={tStudent('count', { count: filteredStudents.length })}
        emptyMessage={
          searchTerm === '' ? null : tStudent('emptySearch', { term: searchTerm.trim() })
        }
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={tCommon('app.confirmDelete')}
        message={tStudent('row.confirmDelete')}
        destructive
        onConfirm={handleConfirmDelete}
        onClose={closeConfirmDelete}
      />
      <AnonymizeStudentsDialogPresenter
        open={rowAnonymize.isOpen}
        count={rowAnonymize.pendingIds.length}
        withoutVisitsCount={rowWithoutVisitsCount}
        onConfirm={rowAnonymize.confirm}
        onClose={rowAnonymize.close}
        isPending={rowAnonymize.isPending}
        errorMessage={rowAnonymize.errorMessage}
      />
      <Toast toast={toast} onClose={dismiss} />
    </StudentListLayout>
  )
}
