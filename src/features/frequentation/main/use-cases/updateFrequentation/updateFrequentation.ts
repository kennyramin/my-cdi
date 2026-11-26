import { z } from 'zod'
import type { DuplicateMatch, FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'
import { ErrorCode } from '@lib/errors'
import { isFutureLocalDateTime, LOCAL_DATE_TIME_PATTERN } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import { ActivityType } from '@types'

export type UpdateOutcome =
  { updated: FrequentationWithStudentEntity } | { duplicates: DuplicateWarningDto[] }

const INVALID_PAYLOAD_ERROR = 'Invalid frequentation update payload'
const FUTURE_STARTS_AT_ERROR = 'startsAt cannot be in the future'
const ANONYMIZED_RELINK_ERROR = 'An anonymized visit cannot be linked to a student again'
const NOT_FOUND_ERROR = 'Frequentation not found'
const STUDENT_NOT_FOUND_ERROR = 'Student not found'
const UNKNOWN_ERROR = 'Unknown error'

const updateFrequentationSchema = z.object({
  startsAt: z.string().regex(LOCAL_DATE_TIME_PATTERN).optional(),
  activity: z.nativeEnum(ActivityType).optional(),
  studentId: z.number().int().positive().safe().optional(),
  allowDuplicates: z.boolean().optional()
})

function dedupeByExistingId(matches: DuplicateMatch[]): DuplicateMatch[] {
  const seen = new Set<number>()
  return matches.filter((match) => {
    if (seen.has(match.existingId)) {
      return false
    }
    seen.add(match.existingId)
    return true
  })
}

export async function updateFrequentation(
  gateway: FrequentationGateway,
  studentGateway: StudentGateway,
  id: number,
  // Untrusted IPC payload: validated at runtime below
  input: unknown,
  now: Date = new Date()
): Promise<UseCaseResult<UpdateOutcome>> {
  const parsed = updateFrequentationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: INVALID_PAYLOAD_ERROR, code: ErrorCode.VALIDATION_ERROR }
  }
  const { allowDuplicates = false, ...dto } = parsed.data

  if (dto.startsAt !== undefined && isFutureLocalDateTime(dto.startsAt, now)) {
    return { success: false, error: FUTURE_STARTS_AT_ERROR, code: ErrorCode.VALIDATION_ERROR }
  }

  try {
    const existing = await gateway.getById(id)
    if (!existing) {
      return { success: false, error: NOT_FOUND_ERROR, code: ErrorCode.FREQUENTATION_NOT_FOUND }
    }

    if (existing.studentId === null && dto.studentId !== undefined) {
      return { success: false, error: ANONYMIZED_RELINK_ERROR, code: ErrorCode.VALIDATION_ERROR }
    }

    if (dto.studentId !== undefined) {
      const found = await studentGateway.getByIds([dto.studentId])
      if (found.length === 0) {
        return {
          success: false,
          error: STUDENT_NOT_FOUND_ERROR,
          code: ErrorCode.STUDENT_NOT_FOUND
        }
      }
    }

    const outcome = await gateway.updateChecked(id, dto, { allowDuplicates })

    if ('duplicates' in outcome) {
      const matches = dedupeByExistingId(outcome.duplicates)
      const students = await studentGateway.getByIds([
        ...new Set(matches.map((match) => match.studentId))
      ])
      const namesById = new Map(
        students.map((student) => [student.id, `${student.prenom} ${student.nom}`])
      )
      const duplicates = matches.map((match) => ({
        studentId: match.studentId,
        studentName: namesById.get(match.studentId) ?? ANONYMIZED_STUDENT_LABEL,
        existingStartsAt: match.existingStartsAt,
        existingActivity: match.existingActivity
      }))
      return { success: true, data: { duplicates } }
    }

    if (outcome.written === null) {
      return { success: false, error: NOT_FOUND_ERROR, code: ErrorCode.FREQUENTATION_NOT_FOUND }
    }

    const updated = await gateway.getWithStudentById(id)
    if (!updated) {
      return { success: false, error: NOT_FOUND_ERROR, code: ErrorCode.FREQUENTATION_NOT_FOUND }
    }
    return { success: true, data: { updated } }
  } catch (error) {
    const message = error instanceof Error ? error.message : UNKNOWN_ERROR
    return { success: false, error: message, code: ErrorCode.DATABASE_ERROR }
  }
}
