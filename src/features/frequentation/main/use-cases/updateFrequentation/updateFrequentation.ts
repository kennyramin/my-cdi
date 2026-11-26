import { z } from 'zod'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { DuplicateWarningDto } from '@frequentation-shared'
import { ErrorCode } from '@lib/errors'
import { isFutureLocalDateTime } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import { buildDuplicateWarnings } from '../helpers/buildDuplicateWarnings'
import {
  activitySchema,
  startsAtSchema,
  studentIdSchema
} from '../helpers/frequentationFieldSchemas'

export type UpdateOutcome =
  { updated: FrequentationWithStudentEntity } | { duplicates: DuplicateWarningDto[] }

const INVALID_PAYLOAD_ERROR = 'Invalid frequentation update payload'
const NOTHING_TO_UPDATE_ERROR = 'Nothing to update'
const FUTURE_STARTS_AT_ERROR = 'startsAt cannot be in the future'
const ANONYMIZED_RELINK_ERROR = 'An anonymized visit cannot be linked to a student again'
const NOT_FOUND_ERROR = 'Frequentation not found'
const STUDENT_NOT_FOUND_ERROR = 'Student not found'
const UNKNOWN_ERROR = 'Unknown error'

const updateFrequentationSchema = z.object({
  startsAt: startsAtSchema.optional(),
  activity: activitySchema.optional(),
  studentId: studentIdSchema.optional(),
  allowDuplicates: z.boolean().optional()
})

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

  if (Object.values(dto).every((value) => value === undefined)) {
    return { success: false, error: NOTHING_TO_UPDATE_ERROR, code: ErrorCode.VALIDATION_ERROR }
  }

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
      const duplicates = await buildDuplicateWarnings(studentGateway, outcome.duplicates)
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
