import AlertTitle from '@mui/material/AlertTitle'
import { useTranslation } from 'react-i18next'
import { Button } from '@ui/components/Button'
import { StatisticsErrorAlert } from './StatisticsErrorPresenter.styles'
import type { StatisticsErrorPresenterProps } from './types/StatisticsErrorPresenterProps'

export function StatisticsErrorPresenter({
  message,
  onRetry,
  isRetrying
}: StatisticsErrorPresenterProps) {
  const { t } = useTranslation('statistics')
  return (
    <StatisticsErrorAlert severity="error" role="alert">
      <AlertTitle>{t('error.title')}</AlertTitle>
      {message}
      <Button variant="secondary" onClick={onRetry} disabled={isRetrying}>
        {t('error.retry')}
      </Button>
    </StatisticsErrorAlert>
  )
}
