import type { ActivityType } from '@types'

export interface EditDraft {
  date: string
  time: string
  studentId: number | null
  activity: ActivityType
}
