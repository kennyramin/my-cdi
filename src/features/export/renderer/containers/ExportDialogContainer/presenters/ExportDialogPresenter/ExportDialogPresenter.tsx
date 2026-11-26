import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@ui/components/Modal'
import { Button } from '@ui/components/Button'
import { ErrorText } from './ExportDialogPresenter.styles'

interface ExportDialogPresenterProps {
  open: boolean
  title: string
  fieldsNode: ReactNode
  canConfirm: boolean
  isPending: boolean
  errorMessage: string | null
  onConfirm: () => void
  onCancel: () => void
  onClose: () => void
}

export function ExportDialogPresenter({
  open,
  title,
  fieldsNode,
  canConfirm,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
  onClose
}: ExportDialogPresenterProps) {
  const { t } = useTranslation('export')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isPending} autoFocus>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isPending || !canConfirm}
            aria-busy={isPending}
          >
            {t('confirm')}
          </Button>
        </>
      }
    >
      {fieldsNode}
      {errorMessage !== null ? (
        <ErrorText variant="body1" role="alert">
          {errorMessage}
        </ErrorText>
      ) : null}
    </Modal>
  )
}
