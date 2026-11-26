import { useRef } from 'react'
import { CalendarContainer } from './containers/CalendarContainer'
import { JournalEntryFormContainer } from './containers/JournalEntryFormContainer'
import { JournalEntryListContainer } from './containers/JournalEntryListContainer'
import { JournalEntryEditDialogPresenter } from '@frequentation/presenters/JournalEntryEditDialogPresenter'
import { buildActivityTiles } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTiles'
import { buildActivityTileNodes } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTileNodes'
import { EditEntryFieldsPresenter } from '@frequentation/presenters/EditEntryFieldsPresenter'
import { DuplicateWarningDialogPresenter } from '@frequentation/presenters/DuplicateWarningDialogPresenter'
import { getEntryAvatar } from '@frequentation/helpers/getEntryAvatar'
import { useJournalPage } from './hooks/useJournalPage'
import { useSubmitBarHeight } from './hooks/useSubmitBarHeight'
import { FormColumn, ListColumn, PageGrid } from './JournalPage.styles'

export function JournalPage() {
  const {
    selectedDate,
    setSelectedDate,
    editingEntry,
    editDraft,
    editingActivity,
    setEditingActivity,
    handleEditDateChange,
    handleEditTimeChange,
    setEditStudent,
    studentOptions,
    editStudentInputValue,
    setEditStudentInputValue,
    isEditAnonymized,
    editDateTimeMessage,
    editStudentMessage,
    editMaxDate,
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
    isSaving
  } = useJournalPage()

  const formColumnRef = useSubmitBarHeight<HTMLDivElement>()
  const editSaveButtonRef = useRef<HTMLButtonElement | null>(null)

  // The clicked save button is disabled while the request runs, so the browser drops focus to
  // <body>: hand it back explicitly when the warning is cancelled or dismissed.
  function handleCancelEditDuplicates() {
    cancelEditDuplicates()
    editSaveButtonRef.current?.focus()
  }

  return (
    <PageGrid>
      <FormColumn ref={formColumnRef}>
        <CalendarContainer selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <JournalEntryFormContainer selectedDate={selectedDate} />
      </FormColumn>
      <ListColumn>
        <JournalEntryListContainer selectedDate={selectedDate} onEditEntry={startEditing} />
      </ListColumn>
      {editingEntry && editDraft && editingActivity ? (
        <JournalEntryEditDialogPresenter
          open
          saveButtonRef={editSaveButtonRef}
          tileNodes={buildActivityTileNodes(
            buildActivityTiles(activityOptions, editingActivity, setEditingActivity)
          )}
          onSubmit={submitEdit}
          onClose={closeEditDialog}
          saving={isSaving}
          canSubmit={canSubmitEdit}
          errorMessage={editError ?? undefined}
          fields={
            <EditEntryFieldsPresenter
              date={editDraft.date}
              time={editDraft.time}
              maxDate={editMaxDate}
              dateTimeMessage={editDateTimeMessage}
              dateTimeHelperId={editFieldIds.dateTimeHelper}
              onDateChange={handleEditDateChange}
              onTimeChange={handleEditTimeChange}
              studentOptions={studentOptions}
              studentInputValue={editStudentInputValue}
              onStudentInputChange={setEditStudentInputValue}
              onStudentSelect={setEditStudent}
              studentLocked={isEditAnonymized}
              studentMessage={editStudentMessage}
              studentInputId={editFieldIds.studentInput}
              studentHelperId={editFieldIds.studentHelper}
            />
          }
          entry={{
            ...getEntryAvatar(editingEntry),
            displayName: editingEntry.student.displayName,
            classe: editingEntry.student.classe
          }}
        />
      ) : null}
      <DuplicateWarningDialogPresenter
        duplicates={pendingEditDuplicates}
        onConfirm={confirmEditDuplicates}
        onCancel={handleCancelEditDuplicates}
        getActivityLabel={getLabel}
        busy={isSaving}
      />
    </PageGrid>
  )
}
