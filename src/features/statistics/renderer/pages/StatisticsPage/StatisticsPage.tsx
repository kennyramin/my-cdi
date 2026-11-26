import { useTranslation } from 'react-i18next'
import { Loader } from '@ui/components/Loader'
import {
  StatisticsChartGrid,
  StatisticsContent,
  StatisticsFullGrid,
  StatisticsLayout,
  StatisticsLoadingShell
} from './StatisticsPage.styles'
import { useStatisticsPage } from './hooks/useStatisticsPage'
import { StatsKpiCardsContainer } from './containers/StatsKpiCardsContainer'
import { PeriodFilterContainer } from './containers/PeriodFilterContainer'
import { WeeklyBarChartContainer } from './containers/WeeklyBarChartContainer'
import { ActivityDonutChartContainer } from './containers/ActivityDonutChartContainer'
import { MonthlyTrendChartContainer } from './containers/MonthlyTrendChartContainer'
import { ClassBarChartContainer } from './containers/ClassBarChartContainer'
import { StatisticsErrorPresenter } from '../../presenters/StatisticsErrorPresenter'
import { StatisticsRefreshErrorPresenter } from '../../presenters/StatisticsRefreshErrorPresenter'

export function StatisticsPage() {
  const {
    period,
    selectPeriod,
    dataRange,
    isStale,
    customRange,
    setCustomRange,
    customRangeError,
    stats,
    isLoading,
    errorMessage,
    retry,
    isRetrying
  } = useStatisticsPage()
  const { t } = useTranslation('statistics')
  const periodFilter = (
    <PeriodFilterContainer
      value={period}
      onChange={selectPeriod}
      customRange={customRange}
      customRangeError={customRangeError}
      onCustomRangeChange={setCustomRange}
    />
  )
  if (!stats) {
    if (isLoading) {
      return (
        <StatisticsLayout>
          {periodFilter}
          <StatisticsLoadingShell>
            <Loader message={t('loading')} />
          </StatisticsLoadingShell>
        </StatisticsLayout>
      )
    }
    return (
      <StatisticsLayout>
        {periodFilter}
        {errorMessage !== null ? (
          <StatisticsErrorPresenter
            message={errorMessage}
            onRetry={retry}
            isRetrying={isRetrying}
          />
        ) : null}
      </StatisticsLayout>
    )
  }
  return (
    <StatisticsLayout>
      {errorMessage !== null ? <StatisticsRefreshErrorPresenter message={errorMessage} /> : null}
      <StatisticsContent data-stale={isStale} aria-busy={isStale}>
        <StatsKpiCardsContainer stats={stats} />
      </StatisticsContent>
      {periodFilter}
      <StatisticsContent data-stale={isStale} aria-busy={isStale}>
        <StatisticsChartGrid>
          <WeeklyBarChartContainer dailyCounts={stats.dailyCounts} />
          <ActivityDonutChartContainer activityCounts={stats.activityCounts} />
        </StatisticsChartGrid>
        <StatisticsFullGrid>
          <MonthlyTrendChartContainer dailyCounts={stats.dailyCounts} range={dataRange} />
          <ClassBarChartContainer classCounts={stats.classCounts} />
        </StatisticsFullGrid>
      </StatisticsContent>
    </StatisticsLayout>
  )
}
