export const ErrorCode = {
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  STUDENT_DUPLICATE_INE: 'STUDENT_DUPLICATE_INE',
  FREQUENTATION_NOT_FOUND: 'FREQUENTATION_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  IPC_ERROR: 'IPC_ERROR',
  CSV_PARSE_ERROR: 'CSV_PARSE_ERROR',
  BACKUP_PATH_IS_LIVE_DB: 'BACKUP_PATH_IS_LIVE_DB',
  BACKUP_WRITE_FAILED: 'BACKUP_WRITE_FAILED',
  RESTORE_NOT_A_DATABASE: 'RESTORE_NOT_A_DATABASE',
  RESTORE_CORRUPTED: 'RESTORE_CORRUPTED',
  RESTORE_MISSING_TABLES: 'RESTORE_MISSING_TABLES',
  RESTORE_NEWER_VERSION: 'RESTORE_NEWER_VERSION',
  RESTORE_UNKNOWN_SCHEMA: 'RESTORE_UNKNOWN_SCHEMA',
  RESTORE_MIGRATION_FAILED: 'RESTORE_MIGRATION_FAILED',
  RESTORE_FAILED: 'RESTORE_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }

  toJSON(): { code: ErrorCode; message: string } {
    return { code: this.code, message: this.message }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
