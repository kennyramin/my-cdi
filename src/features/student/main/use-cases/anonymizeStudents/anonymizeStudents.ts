import { ErrorCode } from '@lib/errors'
import type { UseCaseResult } from '@lib/use-case'
import type { StudentGateway } from '@student/gateways/student'
import type { AnonymizeStudentsPayload, AnonymizeStudentsResult } from '@student-shared'

const ANONYMIZATION_BACKUP_REASON = 'anonymization'

interface AnonymizeStudentsDeps {
  gateway: StudentGateway
  createAutomaticBackup: (reason: typeof ANONYMIZATION_BACKUP_REASON) => Promise<string>
}

function isValidId(id: number): boolean {
  return Number.isInteger(id) && id > 0
}

export async function anonymizeStudents(
  deps: AnonymizeStudentsDeps,
  input: AnonymizeStudentsPayload
): Promise<UseCaseResult<AnonymizeStudentsResult>> {
  if (input.ids.length === 0 || !input.ids.every(isValidId)) {
    return { success: false, error: 'Invalid student ids', code: ErrorCode.VALIDATION_ERROR }
  }

  const uniqueIds = [...new Set(input.ids)]

  let knownIds: number[]
  try {
    const known = await deps.gateway.getByIds(uniqueIds)
    knownIds = known.map((student) => student.id)
  } catch {
    return { success: false, error: 'Failed to read students', code: ErrorCode.DATABASE_ERROR }
  }

  const ignored = uniqueIds.length - knownIds.length
  if (knownIds.length === 0) {
    return { success: true, data: { anonymized: 0, deletedWithoutVisits: 0, ignored } }
  }

  try {
    await deps.createAutomaticBackup(ANONYMIZATION_BACKUP_REASON)
  } catch {
    return {
      success: false,
      error: 'Failed to create the safety backup',
      code: ErrorCode.BACKUP_WRITE_FAILED
    }
  }

  try {
    const { anonymized, deletedWithoutVisits } = await deps.gateway.anonymizeByIds(knownIds)
    return { success: true, data: { anonymized, deletedWithoutVisits, ignored } }
  } catch {
    return { success: false, error: 'Failed to anonymize students', code: ErrorCode.DATABASE_ERROR }
  }
}
