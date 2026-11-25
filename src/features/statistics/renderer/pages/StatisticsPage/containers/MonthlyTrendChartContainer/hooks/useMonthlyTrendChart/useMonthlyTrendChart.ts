import type { DailyCountDto, PeriodRangeDto } from '@statistics-shared'
import { buildTrendPath, DEFAULT_TREND_DIMENSIONS } from '../../helpers/buildTrendPath'

export function useMonthlyTrendChart(dailyCounts: DailyCountDto[], range: PeriodRangeDto) {
  const trend = buildTrendPath(dailyCounts, range)
  const { paddingLeft, paddingRight, width } = DEFAULT_TREND_DIMENSIONS
  const innerRight = width - paddingRight
  return { trend, paddingLeft, innerRight }
}
