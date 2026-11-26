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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('anonymize.title', { count })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {tCommon('app.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending} autoFocus>
            {t('anonymize.confirm')}
          </Button>
        </>
      }
    >
      <MessageText variant="body1">{t('anonymize.message')}</MessageText>
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
