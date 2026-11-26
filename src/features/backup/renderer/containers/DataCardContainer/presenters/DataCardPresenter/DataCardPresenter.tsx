import { useTranslation } from 'react-i18next'
import { Button } from '@ui/components/Button'
import {
  ActionRow,
  WarningHint,
  DataLayout,
  PrivacyNote,
  StatusLine
} from './DataCardPresenter.styles'
import type { DataCardPresenterProps } from './types/DataCardPresenterProps'

export function DataCardPresenter({
  statusText,
  warningText,
  isLoading,
  isError,
  isWarning,
  onRetry,
  automaticCount,
  isBusy,
  onBackup,
  onRestoreStart,
  onDeleteStart
}: DataCardPresenterProps) {
  const { t } = useTranslation('common')

  return (
    <DataLayout>
      <StatusLine
        role="status"
        aria-live="polite"
        data-warning={isWarning}
        data-loading={isLoading}
      >
        {statusText}
        {warningText !== '' ? <WarningHint>{warningText}</WarningHint> : null}
      </StatusLine>
      {isError ? (
        <ActionRow>
          <Button variant="secondary" onClick={onRetry}>
            {t('settings.data.retry')}
          </Button>
        </ActionRow>
      ) : null}
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
