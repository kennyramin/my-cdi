import { useTranslation } from 'react-i18next'
import { Modal } from '@ui/components/Modal'
import { Button } from '@ui/components/Button'
import { ErrorText, MessageText } from './AnonymizeStudentsDialogPresenter.styles'

const NONE = 0

export interface AnonymizeStudentsDialogPresenterProps {
  open: boolean
  count: number
  withoutVisitsCount: number
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
  errorMessage: string | null
}

export function AnonymizeStudentsDialogPresenter({
  open,
  count,
  withoutVisitsCount,
  onConfirm,
  onClose,
  isPending,
  errorMessage
}: AnonymizeStudentsDialogPresenterProps) {
  const { t: tCommon } = useTranslation('common')
  const { t } = useTranslation('student')
  const keepsVisits = withoutVisitsCount < count

  function handleClose() {
    if (!isPending) {
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('anonymize.title', { count })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending} autoFocus>
            {tCommon('app.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {t('anonymize.confirm')}
          </Button>
        </>
      }
    >
      <MessageText variant="body1">
        {t(keepsVisits ? 'anonymize.message' : 'anonymize.messageNoVisits')}
      </MessageText>
      {withoutVisitsCount > NONE ? (
        <MessageText variant="body1">
          {t('anonymize.noVisitsNote', { count: withoutVisitsCount })}
        </MessageText>
      ) : null}
      <MessageText variant="body1">{t('anonymize.backupNote')}</MessageText>
      {errorMessage !== null ? (
        <ErrorText variant="body1" role="alert">
          {errorMessage}
        </ErrorText>
      ) : null}
    </Modal>
  )
}
