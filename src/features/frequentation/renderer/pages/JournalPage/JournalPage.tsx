import { CalendarContainer } from './containers/CalendarContainer'
import { JournalEntryFormContainer } from './containers/JournalEntryFormContainer'
import { JournalEntryListContainer } from './containers/JournalEntryListContainer'
import { JournalEntryEditDialogPresenter } from '@frequentation/presenters/JournalEntryEditDialogPresenter'
import { buildActivityTiles } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTiles'
import { buildActivityTileNodes } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTileNodes'
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
  } = useJournalPage()

  const formColumnRef = useSubmitBarHeight<HTMLDivElement>()

  return (
    <PageGrid>
      <FormColumn ref={formColumnRef}>
        <CalendarContainer selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <JournalEntryFormContainer selectedDate={selectedDate} />
      </FormColumn>
      <ListColumn>
        <JournalEntryListContainer selectedDate={selectedDate} onEditEntry={startEditing} />
      </ListColumn>
      {editingEntry && editingActivity ? (
        <JournalEntryEditDialogPresenter
          open
          tileNodes={buildActivityTileNodes(
            buildActivityTiles(activityOptions, editingActivity, setEditingActivity)
          )}
          onSubmit={submitEdit}
          onClose={closeEditDialog}
          entry={{
            ...getEntryAvatar(editingEntry),
            displayName: editingEntry.student.displayName,
            classe: editingEntry.student.classe
          }}
        />
      ) : null}
      <DuplicateWarningDialogPresenter
        duplicates={pendingDuplicates}
        onConfirm={confirmDuplicates}
        onCancel={cancelDuplicates}
        getActivityLabel={getLabel}
      />
    </PageGrid>
  )
}
