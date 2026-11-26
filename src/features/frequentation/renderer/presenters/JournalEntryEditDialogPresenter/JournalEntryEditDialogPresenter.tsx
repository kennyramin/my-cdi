import { useTranslation } from 'react-i18next'
import type { ReactNode, Ref } from 'react'
import { Modal } from '@ui/components/Modal'
import { Button } from '@ui/components/Button'
import { Avatar } from '@ui/components/Avatar'
import { ActivityGridPresenter } from '@frequentation/presenters/ActivityGridPresenter'
import {
  EntrySummary,
  ErrorText,
  OriginalCaption,
  StudentClasse,
  StudentName
} from './JournalEntryEditDialogPresenter.styles'

export interface EditDialogEntryViewModel {
  initials: string
  colorSeed: number | null
  neutral: boolean
  displayName: string
  classe: string
}

interface JournalEntryEditDialogPresenterProps {
  open: boolean
  tileNodes: ReactNode[]
  onSubmit: () => void
  onClose: () => void
  fields: ReactNode
  canSubmit: boolean
  errorMessage?: string
  saving?: boolean
  entry?: EditDialogEntryViewModel
  saveButtonRef?: Ref<HTMLButtonElement>
}

export function JournalEntryEditDialogPresenter({
  open,
  tileNodes,
  onSubmit,
  onClose,
  fields,
  canSubmit,
  errorMessage,
  saving = false,
  entry,
  saveButtonRef
}: JournalEntryEditDialogPresenterProps) {
  const { t } = useTranslation('frequentation')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('edit.title')}
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button
            ref={saveButtonRef}
            variant="primary"
            onClick={onSubmit}
            disabled={saving || !canSubmit}
          >
            {t('edit.save')}
          </Button>
        </>
      }
    >
      {entry ? (
        <EntrySummary aria-label={t('edit.original')}>
          <OriginalCaption variant="caption">{t('edit.original')}</OriginalCaption>
          <Avatar initials={entry.initials} colorSeed={entry.colorSeed} neutral={entry.neutral} />
          <div>
            <StudentName variant="body1">{entry.displayName}</StudentName>
            <StudentClasse variant="caption">{entry.classe}</StudentClasse>
          </div>
        </EntrySummary>
      ) : null}
      {errorMessage ? <ErrorText role="alert">{errorMessage}</ErrorText> : null}
      {fields}
      <ActivityGridPresenter tileNodes={tileNodes} />
    </Modal>
  )
}
