import { useTranslation } from 'react-i18next'
import { Button } from '@ui/components/Button'
import { ActionRow, DataLayout, PrivacyNote, StatusLine } from './DataCardPresenter.styles'
import type { DataCardPresenterProps } from './types/DataCardPresenterProps'

export function DataCardPresenter({
  statusText,
  isWarning,
  automaticCount,
  isBusy,
  onBackup,
  onRestoreStart,
  onDeleteStart
}: DataCardPresenterProps) {
  const { t } = useTranslation('common')

  return (
    <DataLayout>
      <StatusLine data-warning={isWarning}>{statusText}</StatusLine>
      <ActionRow>
        <Button onClick={onBackup} disabled={isBusy}>
          {t('settings.data.backup')}
        </Button>
        <Button variant="secondary" onClick={onRestoreStart} disabled={isBusy}>
          {t('settings.data.restore')}
        </Button>
        <Button
          variant="secondary"
          onClick={onDeleteStart}
          disabled={isBusy || automaticCount === 0}
        >
          {t('settings.data.deleteAutomatic', { count: automaticCount })}
        </Button>
      </ActionRow>
      <PrivacyNote>{t('settings.data.privacy')}</PrivacyNote>
    </DataLayout>
  )
}
