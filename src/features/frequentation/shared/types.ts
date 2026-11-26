export const ANONYMIZED_STUDENT_LABEL = 'Élève anonymisé'
export const UNKNOWN_CLASS_LABEL = 'Classe inconnue'

import type { ActivityType } from '@types'

export interface CreateFrequentationDto {
  startsAt: string
  activity: ActivityType
  studentId: number
}

export interface UpdateFrequentationDto {
  startsAt?: string
  activity?: ActivityType
  studentId?: number
}

export interface CreateFrequentationBatchDto {
  frequentations: CreateFrequentationDto[]
}

export interface FrequentationResponseDto {
  id: number
  startsAt: string
  activity: ActivityType
  studentId: number | null
  studentName: string
  studentClass: string
  studentIne: string | null
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
