import { describe, expect, it } from 'vitest'
import { AppError, ErrorCode } from '@lib/errors'
import { buildStartupErrorMessage } from '../buildStartupErrorMessage'

const DB_PATH = '/data/database.db'

describe('buildStartupErrorMessage', () => {
  it('tells the user a backup failed and does not suggest deleting the database', () => {
    const error = new AppError(ErrorCode.BACKUP_WRITE_FAILED, 'ENOSPC: no space left')

    const message = buildStartupErrorMessage(error, DB_PATH)

    expect(message).toContain('safety backup could not be written')
    expect(message).toContain('ENOSPC: no space left')
    expect(message).toContain(DB_PATH)
    expect(message).not.toContain('delete the file')
  })

  it('keeps the outdated-schema advice for other failures', () => {
    const message = buildStartupErrorMessage(new Error('no such column'), DB_PATH)

    expect(message).toContain('no such column')
    expect(message).toContain('delete the file and restart the app')
  })

  it('handles values that are not errors', () => {
    expect(buildStartupErrorMessage('boom', DB_PATH)).toContain('Unknown error')
  })
})
