import { AppError, ErrorCode } from '@lib/errors'

const UNKNOWN_ERROR_MESSAGE = 'Unknown error'
const HEADLINE = 'Failed to initialize the database.'
const BACKUP_FAILURE_ADVICE =
  'A safety backup could not be written before updating the data, so the update was not applied. ' +
  'Nothing was deleted: free some disk space or check the permissions of the backups folder, then restart the app.'
const SCHEMA_ADVICE = 'If the database schema is outdated, delete the file and restart the app.'

export function buildStartupErrorMessage(error: unknown, databasePath: string): string {
  const message = error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE
  const advice =
    error instanceof AppError && error.code === ErrorCode.BACKUP_WRITE_FAILED
      ? BACKUP_FAILURE_ADVICE
      : SCHEMA_ADVICE
  return `${HEADLINE}\n\nPath: ${databasePath}\nError: ${message}\n\n${advice}`
}
