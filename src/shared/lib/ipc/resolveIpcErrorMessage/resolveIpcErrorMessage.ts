import { ErrorCode } from '@lib/errors'

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  [ErrorCode.STUDENT_NOT_FOUND]: 'errors.studentNotFound',
  [ErrorCode.STUDENT_DUPLICATE_INE]: 'errors.duplicateIne',
  [ErrorCode.FREQUENTATION_NOT_FOUND]: 'errors.frequentationNotFound',
  [ErrorCode.VALIDATION_ERROR]: 'errors.validation',
  [ErrorCode.DATABASE_ERROR]: 'errors.generic',
  [ErrorCode.IPC_ERROR]: 'errors.generic',
  [ErrorCode.CSV_PARSE_ERROR]: 'errors.generic',
  [ErrorCode.BACKUP_PATH_IS_LIVE_DB]: 'errors.backup.pathIsLiveDb',
  [ErrorCode.BACKUP_WRITE_FAILED]: 'errors.backup.writeFailed',
  [ErrorCode.RESTORE_NOT_A_DATABASE]: 'errors.restore.notADatabase',
  [ErrorCode.RESTORE_CORRUPTED]: 'errors.restore.corrupted',
  [ErrorCode.RESTORE_MISSING_TABLES]: 'errors.restore.missingTables',
  [ErrorCode.RESTORE_NEWER_VERSION]: 'errors.restore.newerVersion',
  [ErrorCode.RESTORE_UNKNOWN_SCHEMA]: 'errors.restore.unknownSchema',
  [ErrorCode.RESTORE_MIGRATION_FAILED]: 'errors.restore.migrationFailed',
  [ErrorCode.RESTORE_FAILED]: 'errors.restore.failed',
  [ErrorCode.EXPORT_WRITE_FAILED]: 'errors.exportWriteFailed',
  [ErrorCode.UNKNOWN_ERROR]: 'app.unknownError'
}

interface IpcFailure {
  error: string
  code?: string
}

export function resolveIpcErrorMessage(
  result: IpcFailure,
  translate: (key: string) => string
): string {
  const key = result.code !== undefined ? ERROR_MESSAGE_KEYS[result.code] : undefined
  return key !== undefined ? translate(key) : result.error
}
