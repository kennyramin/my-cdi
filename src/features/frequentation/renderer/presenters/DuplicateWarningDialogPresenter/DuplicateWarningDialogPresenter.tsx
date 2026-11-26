import { useTranslation } from 'react-i18next'
import { Modal } from '@ui/components/Modal'
import { Button } from '@ui/components/Button'
import { formatDuplicateLine } from '@frequentation/helpers/formatDuplicateLine'
import type { DuplicateWarningDto } from '@frequentation-shared'
import type { ActivityType } from '@types'
import { DuplicateList, IntroText } from './DuplicateWarningDialogPresenter.styles'

interface DuplicateWarningDialogPresenterProps {
  duplicates: DuplicateWarningDto[]
  onConfirm: () => void
  onCancel: () => void
  getActivityLabel: (activity: ActivityType) => string
}

export function DuplicateWarningDialogPresenter({
  duplicates,
  onConfirm,
  onCancel,
  getActivityLabel
}: DuplicateWarningDialogPresenterProps) {
  const { t } = useTranslation('frequentation')
  return (
    <Modal
      open={duplicates.length > 0}
      onClose={onCancel}
      title={t('duplicate.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {t('duplicate.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('duplicate.confirm')}
          </Button>
        </>
      }
    >
      <IntroText variant="body1">{t('duplicate.intro', { count: duplicates.length })}</IntroText>
      <DuplicateList>
        {duplicates.map((duplicate) => (
          <li key={`${duplicate.studentId}-${duplicate.existingStartsAt}`}>
            {formatDuplicateLine(duplicate, getActivityLabel(duplicate.existingActivity), t)}
          </li>
        ))}
      </DuplicateList>
    </Modal>
  )
}
