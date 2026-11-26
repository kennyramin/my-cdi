import { useTranslation } from 'react-i18next'
import { StatisticsRefreshErrorAlert } from './StatisticsRefreshErrorPresenter.styles'
import type { StatisticsRefreshErrorPresenterProps } from './types/StatisticsRefreshErrorPresenterProps'

export function StatisticsRefreshErrorPresenter({ message }: StatisticsRefreshErrorPresenterProps) {
  const { t } = useTranslation('statistics')
  return (
    <StatisticsRefreshErrorAlert severity="warning" role="status">
      {t('error.refreshFailed', { message })}
    </StatisticsRefreshErrorAlert>
  )
}
