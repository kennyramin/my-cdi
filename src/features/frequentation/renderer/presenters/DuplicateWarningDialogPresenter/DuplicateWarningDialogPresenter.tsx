import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@ui/components/Modal'
import { Button } from '@ui/components/Button'
import { formatDuplicateLine } from '@frequentation/helpers/formatDuplicateLine'
import { DUPLICATE_WINDOW_SECONDS } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'
import type { ActivityType } from '@types'
import { DuplicateList, IntroText } from './DuplicateWarningDialogPresenter.styles'

const SECONDS_PER_MINUTE = 60
const WINDOW_MINUTES = DUPLICATE_WINDOW_SECONDS / SECONDS_PER_MINUTE

interface DuplicateWarningDialogPresenterProps {
  duplicates: DuplicateWarningDto[]
  onConfirm: () => void
  onCancel: () => void
  getActivityLabel: (activity: ActivityType) => string
  busy?: boolean
}

export function DuplicateWarningDialogPresenter({
  duplicates,
  onConfirm,
  onCancel,
  getActivityLabel,
  busy = false
}: DuplicateWarningDialogPresenterProps) {
  const { t } = useTranslation('frequentation')
  const isOpen = duplicates.length > 0
  // Keep the last non-empty list so the exit transition never shows an empty dialog.
  const [shown, setShown] = useState(duplicates)
  if (isOpen && duplicates !== shown) {
    setShown(duplicates)
  }
  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title={t('duplicate.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {t('duplicate.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {t('duplicate.confirm')}
          </Button>
        </>
      }
    >
      <IntroText variant="body1">
        {t('duplicate.intro', { count: shown.length, minutes: WINDOW_MINUTES })}
      </IntroText>
      <DuplicateList>
        {shown.map((duplicate) => (
          <li
            key={`${duplicate.studentId}-${duplicate.existingStartsAt}-${duplicate.existingActivity}`}
          >
            {formatDuplicateLine(duplicate, getActivityLabel(duplicate.existingActivity), t)}
          </li>
        ))}
      </DuplicateList>
    </Modal>
  )
}
