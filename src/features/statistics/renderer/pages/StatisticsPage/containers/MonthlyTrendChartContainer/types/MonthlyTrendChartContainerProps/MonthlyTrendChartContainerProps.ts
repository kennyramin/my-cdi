import type { DailyCountDto, PeriodRangeDto } from '@statistics-shared'

export interface MonthlyTrendChartContainerProps {
  dailyCounts: DailyCountDto[]
  range: PeriodRangeDto
}
