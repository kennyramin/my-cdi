import type { DailyCountDto, PeriodRangeDto } from '@statistics-shared'
import { countDaysBetween } from '../countDaysBetween'
import { formatDayMonth } from '../formatDayMonth'

export interface TrendDimensions {
  width: number
  height: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

export interface TrendDot {
  cx: number
  cy: number
  date: string
  dayLabel: string
  count: number
}

export interface TrendYLabel {
  id: 'min' | 'mid' | 'max'
  y: number
  value: number
}

export interface TrendXLabel {
  id: 'start' | 'end'
  x: number
  label: string
  anchor: 'start' | 'end'
}

export interface TrendPath {
  path: string
  areaPath: string
  dots: TrendDot[]
  yLabels: TrendYLabel[]
  xLabels: TrendXLabel[]
  viewBox: string
}

const HALF_DIVISOR = 2
const Y_LABEL_X_OFFSET = 6
const EMPTY_PATH: TrendPath = {
  path: '',
  areaPath: '',
  dots: [],
  yLabels: [],
  xLabels: [],
  viewBox: '0 0 0 0'
}

const DEFAULT_WIDTH = 700
const DEFAULT_HEIGHT = 200
const DEFAULT_PADDING_VERTICAL = 10
const DEFAULT_PADDING_BOTTOM = 30
const DEFAULT_PADDING_LEFT = 40

export const DEFAULT_TREND_DIMENSIONS: TrendDimensions = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  paddingTop: DEFAULT_PADDING_VERTICAL,
  paddingRight: DEFAULT_PADDING_VERTICAL,
  paddingBottom: DEFAULT_PADDING_BOTTOM,
  paddingLeft: DEFAULT_PADDING_LEFT
}

export function buildTrendPath(
  dailyCounts: DailyCountDto[],
  range: PeriodRangeDto,
  dimensions: TrendDimensions = DEFAULT_TREND_DIMENSIONS
): TrendPath {
  const viewBox = `0 0 ${dimensions.width} ${dimensions.height}`
  if (dailyCounts.length === 0) {
    return { ...EMPTY_PATH, viewBox }
  }
  const sorted = [...dailyCounts].sort((left, right) => (left.date < right.date ? -1 : 1))
  const rawMax = Math.max(...sorted.map((item) => item.count))
  const max = rawMax === 0 ? 1 : rawMax
  const innerWidth = dimensions.width - dimensions.paddingLeft - dimensions.paddingRight
  const innerHeight = dimensions.height - dimensions.paddingTop - dimensions.paddingBottom
  const baseY = dimensions.height - dimensions.paddingBottom
  const spanDays = countDaysBetween(range.startDate, range.endDate)
  const toY = (value: number) => dimensions.paddingTop + (1 - value / max) * innerHeight
  const dots: TrendDot[] = sorted.map((item) => ({
    cx:
      dimensions.paddingLeft +
      (spanDays === 0
        ? innerWidth / HALF_DIVISOR
        : (countDaysBetween(range.startDate, item.date) / spanDays) * innerWidth),
    cy: toY(item.count),
    date: item.date,
    dayLabel: formatDayMonth(item.date),
    count: item.count
  }))
  const path = `M${dots.map((dot) => `${dot.cx},${dot.cy}`).join(' L')}`
  const firstX = dots[0]?.cx ?? dimensions.paddingLeft
  const lastX = dots[dots.length - 1]?.cx ?? dimensions.paddingLeft
  const areaPath = `${path} L${lastX},${baseY} L${firstX},${baseY} Z`
  const midValue = Math.round(max / HALF_DIVISOR)
  const yLabels: TrendYLabel[] = [
    { id: 'min', value: 0, y: toY(0) },
    { id: 'mid', value: midValue, y: toY(midValue) },
    { id: 'max', value: max, y: toY(max) }
  ]
  const xLabels: TrendXLabel[] = [
    {
      id: 'start',
      x: dimensions.paddingLeft,
      label: formatDayMonth(range.startDate),
      anchor: 'start'
    },
    {
      id: 'end',
      x: dimensions.width - dimensions.paddingRight,
      label: formatDayMonth(range.endDate),
      anchor: 'end'
    }
  ]
  return { path, areaPath, dots, yLabels, xLabels, viewBox }
}

export const Y_LABEL_OFFSET_X = Y_LABEL_X_OFFSET
