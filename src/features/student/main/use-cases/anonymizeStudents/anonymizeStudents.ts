import { z } from 'zod'
import { ErrorCode } from '@lib/errors'
import type { UseCaseResult } from '@lib/use-case'
import type { StudentGateway } from '@student/gateways/student'
import type { AnonymizeStudentsResult } from '@student-shared'

export const MAX_ANONYMIZE_IDS = 5000

const anonymizeStudentsSchema = z.object({
  ids: z.array(z.number().int().positive().safe()).min(1).max(MAX_ANONYMIZE_IDS)
})

const ANONYMIZATION_BACKUP_REASON = 'anonymization'

interface AnonymizeStudentsDeps {
  gateway: StudentGateway
  createAutomaticBackup: (reason: typeof ANONYMIZATION_BACKUP_REASON) => Promise<string>
}

export async function anonymizeStudents(
  deps: AnonymizeStudentsDeps,
  // Untrusted IPC payload: validated at runtime below
  input: unknown
): Promise<UseCaseResult<AnonymizeStudentsResult>> {
  const parsed = anonymizeStudentsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid student ids', code: ErrorCode.VALIDATION_ERROR }
  }

  const uniqueIds = [...new Set(parsed.data.ids)]

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
    await deps.gateway.checkpoint()
    return { success: true, data: { anonymized, deletedWithoutVisits, ignored } }
  } catch {
    return { success: false, error: 'Failed to anonymize students', code: ErrorCode.DATABASE_ERROR }
  }
}
