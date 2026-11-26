import { z } from 'zod'

export const NOM_MAX_LENGTH = 100
export const PRENOM_MAX_LENGTH = 100
export const CLASSE_MAX_LENGTH = 50
export const INE_MAX_LENGTH = 50

export const createStudentSchema = z.object({
  nom: z.string().trim().min(1).max(NOM_MAX_LENGTH),
  prenom: z.string().trim().min(1).max(PRENOM_MAX_LENGTH),
  classe: z.string().trim().min(1).max(CLASSE_MAX_LENGTH),
  ine: z.string().trim().min(1).max(INE_MAX_LENGTH)
})

export const updateStudentSchema = z.object({
  nom: z.string().trim().min(1).max(NOM_MAX_LENGTH).optional(),
  prenom: z.string().trim().min(1).max(PRENOM_MAX_LENGTH).optional(),
  classe: z.string().trim().min(1).max(CLASSE_MAX_LENGTH).optional(),
  ine: z.string().trim().min(1).max(INE_MAX_LENGTH).optional()
})

export type CreateStudentDto = z.infer<typeof createStudentSchema>

export type UpdateStudentDto = z.infer<typeof updateStudentSchema>

export interface StudentResponseDto {
  id: number
  nom: string
  prenom: string
  classe: string
  ine: string
  fullName: string
  createdAt: string
  updatedAt: string
  visitCount: number
}

export interface StudentListResponseDto {
  students: StudentResponseDto[]
}

export interface CsvRowIssue {
  field: string
  code: string
}

export type CsvImportError =
  | { type: 'MISSING_COLUMNS'; columns: string[] }
  | { type: 'ROW_VALIDATION'; rowNumber: number; issues: CsvRowIssue[] }
  | {
      type: 'DUPLICATE_INE'
      studentName: string
      existingName?: string
      existingClasse?: string
    }
  | { type: 'DATABASE_ERROR'; studentName: string; message: string }

export interface CsvImportResult {
  created: number
  updated: number
  errors: number
  errorDetails: CsvImportError[]
  anonymized?: number
  deletedWithoutVisits?: number
}

export type CsvDuplicateInePolicy = 'skip' | 'replace'

export interface ImportStudentsCsvPayload {
  csv: string
  onDuplicateIne?: CsvDuplicateInePolicy
  removeAbsent?: boolean
  removalConfirmation?: string
  removalExpectation?: CsvRemovalExpectation
}

export interface CsvRemovalExpectation {
  count: number
  fingerprint: string
}

export type CsvRemovalBlockedReason = 'rowErrors' | 'emptyFile'

export interface CsvRemovalPreview {
  toRemove: number
  total: number
  sample: string[]
  fingerprint: string
  blockedReason?: CsvRemovalBlockedReason
}

export interface PreviewCsvRemovalPayload {
  csv: string
}

export interface AnonymizeStudentsPayload {
  ids: number[]
}

export interface AnonymizeStudentsResult {
  anonymized: number
  deletedWithoutVisits: number
  ignored: number
}
