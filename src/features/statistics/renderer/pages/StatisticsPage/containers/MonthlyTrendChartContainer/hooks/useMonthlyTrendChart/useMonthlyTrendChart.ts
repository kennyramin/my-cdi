import type { DailyCountDto, PeriodRangeDto } from '@statistics-shared'
import { buildTrendPath, DEFAULT_TREND_DIMENSIONS } from '../../helpers/buildTrendPath'
import { useElementWidth } from '../useElementWidth'

export function useMonthlyTrendChart(dailyCounts: DailyCountDto[], range: PeriodRangeDto) {
  const { ref: chartRef, width } = useElementWidth<HTMLDivElement>(DEFAULT_TREND_DIMENSIONS.width)
  const dimensions = { ...DEFAULT_TREND_DIMENSIONS, width }
  const trend = buildTrendPath(dailyCounts, range, dimensions)
  const innerRight = width - dimensions.paddingRight
  return { chartRef, trend, paddingLeft: dimensions.paddingLeft, innerRight }
}
