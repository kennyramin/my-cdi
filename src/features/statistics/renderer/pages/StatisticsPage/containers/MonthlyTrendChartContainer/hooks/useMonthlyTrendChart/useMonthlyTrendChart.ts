import { useTranslation } from 'react-i18next'
import type { DailyCountDto, PeriodRangeDto } from '@statistics-shared'
import { buildTrendPath, DEFAULT_TREND_DIMENSIONS } from '../../helpers/buildTrendPath'
import { formatDayMonth } from '../../helpers/formatDayMonth'
import { useElementWidth } from '../useElementWidth'

function findPeakDay(dailyCounts: DailyCountDto[]): DailyCountDto | null {
  return dailyCounts.reduce<DailyCountDto | null>((peak, item) => {
    if (peak === null || item.count > peak.count) {
      return item
    }
    if (item.count === peak.count && item.date < peak.date) {
      return item
    }
    return peak
  }, null)
}

export function useMonthlyTrendChart(dailyCounts: DailyCountDto[], range: PeriodRangeDto) {
  const { t } = useTranslation('statistics')
  const { ref: chartRef, width } = useElementWidth<HTMLDivElement>(DEFAULT_TREND_DIMENSIONS.width)
  const dimensions = { ...DEFAULT_TREND_DIMENSIONS, width }
  const trend = buildTrendPath(dailyCounts, range, dimensions)
  const innerRight = width - dimensions.paddingRight
  const peak = findPeakDay(dailyCounts)
  const totalVisits = dailyCounts.reduce((sum, item) => sum + item.count, 0)
  const bounds = { start: formatDayMonth(range.startDate), end: formatDayMonth(range.endDate) }
  const summary =
    peak === null || totalVisits === 0
      ? t('charts.trendSummaryEmpty', bounds)
      : t('charts.trendSummary', {
          ...bounds,
          visits: t('charts.visitsCount', { count: totalVisits }),
          days: t('charts.activeDays', { count: dailyCounts.length }),
          max: peak.count,
          maxDate: formatDayMonth(peak.date)
        })
  return { chartRef, trend, paddingLeft: dimensions.paddingLeft, innerRight, summary }
}
