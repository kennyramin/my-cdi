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
