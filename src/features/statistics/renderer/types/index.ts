import type { PeriodRangeDto, StatsForPeriodDto } from '@statistics-shared'

export type PeriodKey = 'week' | 'month' | 'quarter' | 'semester' | 'schoolYear' | 'custom'

export interface PeriodOption {
  value: PeriodKey
  label: string
  iconName?: string
}

export interface StatDelta {
  sign: 'up' | 'down'
  text: string
}

export type PresetPeriodKey = Exclude<PeriodKey, 'custom'>

export type CustomRangeError = 'incomplete' | 'endBeforeStart'

export interface StatsForRange {
  range: PeriodRangeDto
  stats: StatsForPeriodDto
}
