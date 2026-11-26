import { z } from 'zod'

export const AUTOMATIC_BACKUP_REASONS = [
  'migration',
  'normalization',
  'anonymization',
  'restore'
] as const

export type AutomaticBackupReason = (typeof AUTOMATIC_BACKUP_REASONS)[number]

export type BackupCreateResult = { path: string } | { cancelled: true }

export const restoreInputSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('select') }),
  z.object({ phase: z.literal('confirm') })
])

export type RestoreInput = z.infer<typeof restoreInputSchema>

export type RestoreResult = { cancelled: true } | { fileName: string } | { restored: true }

export interface BackupStatusDto {
  lastBackupAt: string | null
  automaticCount: number
}

export interface DeleteAutomaticResultDto {
  deleted: number
}
