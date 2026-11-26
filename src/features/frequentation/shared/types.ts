import type { ActivityType } from '@types'

export const ANONYMIZED_STUDENT_LABEL = 'Élève anonymisé'
export const UNKNOWN_CLASS_LABEL = 'Classe inconnue'

export const DUPLICATE_WINDOW_SECONDS = 1800

export interface CreateFrequentationDto {
  startsAt: string
  activity: ActivityType
  studentId: number
}

export interface UpdateFrequentationDto {
  startsAt?: string
  activity?: ActivityType
  studentId?: number
  allowDuplicates?: boolean
}

export interface CreateFrequentationBatchDto {
  frequentations: CreateFrequentationDto[]
  allowDuplicates?: boolean
}

export interface DuplicateWarningDto {
  studentId: number
  studentName: string
  existingStartsAt: string
  existingActivity: ActivityType
}

export interface DuplicatesFoundDto {
  created: 0
  duplicates: DuplicateWarningDto[]
}

export function isDuplicatesFound(value: unknown): value is DuplicatesFoundDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'duplicates' in value &&
    Array.isArray(value.duplicates)
  )
}

export interface FrequentationResponseDto {
  id: number
  startsAt: string
  activity: ActivityType
  studentId: number | null
  studentName: string
  studentClass: string
  studentIne: string
  createdAt: string
  updatedAt: string
}

export interface JournalEntryDto {
  frequentation: FrequentationResponseDto
  student: {
    id: number
    nom: string
    prenom: string
    classe: string
    ine: string
  } | null
}

export interface DateRangeDto {
  startDate: string
  endDate: string
}
