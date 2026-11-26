import { describe, it, expect } from 'vitest'
import { resolveIpcErrorMessage } from '../resolveIpcErrorMessage'
import { ErrorCode } from '@lib/errors'

function translate(key: string): string {
  const MESSAGES: Record<string, string> = {
    'errors.studentNotFound': 'Élève introuvable',
    'errors.duplicateIne': 'Un élève avec cet INE existe déjà',
    'errors.frequentationNotFound': 'Fréquentation introuvable',
    'errors.validation': 'Les données envoyées sont invalides',
    'errors.generic': 'Une erreur est survenue',
    'app.unknownError': 'Une erreur inconnue est survenue'
  }
  const message = MESSAGES[key]
  if (message === undefined) {
    throw new Error(`Missing translation: ${key}`)
  }
  return message
}

describe('resolveIpcErrorMessage', () => {
  it('translates a known error code', () => {
    expect(
      resolveIpcErrorMessage(
        { error: 'Student not found', code: ErrorCode.STUDENT_NOT_FOUND },
        translate
      )
    ).toBe('Élève introuvable')
  })

  it('translates the duplicate INE code', () => {
    expect(
      resolveIpcErrorMessage(
        { error: 'A student with this INE already exists', code: ErrorCode.STUDENT_DUPLICATE_INE },
        translate
      )
    ).toBe('Un élève avec cet INE existe déjà')
  })

  it('falls back to the raw error when the code is unknown', () => {
    expect(
      resolveIpcErrorMessage({ error: 'sqlite failure', code: 'SQLITE_BUSY' }, translate)
    ).toBe('sqlite failure')
  })

  it('falls back to the raw error when there is no code', () => {
    expect(resolveIpcErrorMessage({ error: 'raw failure' }, translate)).toBe('raw failure')
  })

  it('maps every new backup/restore error code to a non-generic translation key', () => {
    const codes = [
      ErrorCode.BACKUP_PATH_IS_LIVE_DB,
      ErrorCode.BACKUP_WRITE_FAILED,
      ErrorCode.RESTORE_NOT_A_DATABASE,
      ErrorCode.RESTORE_CORRUPTED,
      ErrorCode.RESTORE_MISSING_TABLES,
      ErrorCode.RESTORE_NEWER_VERSION,
      ErrorCode.RESTORE_UNKNOWN_SCHEMA,
      ErrorCode.RESTORE_MIGRATION_FAILED,
      ErrorCode.RESTORE_FAILED
    ]
    for (const code of codes) {
      const result = { error: `raw ${code}`, code }
      expect(resolveIpcErrorMessage(result, (key) => `t:${key}`)).not.toBe(result.error)
    }
  })

  it('maps EXPORT_WRITE_FAILED to errors.exportWriteFailed', () => {
    expect(
      resolveIpcErrorMessage({ error: 'raw', code: ErrorCode.EXPORT_WRITE_FAILED }, (key) => key)
    ).toBe('errors.exportWriteFailed')
  })

  it('maps EXPORT_FILE_LOCKED to errors.exportFileLocked', () => {
    expect(
      resolveIpcErrorMessage({ error: 'raw', code: ErrorCode.EXPORT_FILE_LOCKED }, (key) => key)
    ).toBe('errors.exportFileLocked')
  })
})
