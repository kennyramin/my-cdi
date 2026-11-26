import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { CreateFrequentationDto, DuplicateWarningDto } from '@frequentation-shared'
import { ErrorCode } from '@lib/errors'
import { isFutureLocalDateTime } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import { buildDuplicateWarnings } from '../helpers/buildDuplicateWarnings'
import type { BatchItemError, BatchResult } from './types/BatchResult'
import { createFrequentationBatchSchema } from './validations/createFrequentationBatchSchema'

export type CreateBatchOutcome = BatchResult | { duplicates: DuplicateWarningDto[] }

const FUTURE_STARTS_AT_ERROR = 'startsAt cannot be in the future'
const STUDENT_NOT_FOUND_ERROR = 'Student not found'
const UNKNOWN_ERROR = 'Unknown error'

export async function createFrequentationBatch(
  gateway: FrequentationGateway,
  studentGateway: StudentGateway,
  // Untrusted IPC payload: validated at runtime below
  input: unknown,
  now: Date = new Date()
): Promise<UseCaseResult<CreateBatchOutcome>> {
  const parsed = createFrequentationBatchSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, code: ErrorCode.VALIDATION_ERROR }
  }
  const { frequentations, allowDuplicates = false } = parsed.data

  if (frequentations.some((item) => isFutureLocalDateTime(item.startsAt, now))) {
    return { success: false, error: FUTURE_STARTS_AT_ERROR, code: ErrorCode.VALIDATION_ERROR }
  }

  try {
    const students = await studentGateway.getByIds([
      ...new Set(frequentations.map((item) => item.studentId))
    ])
    const knownIds = new Set(students.map((student) => student.id))

    const errors: BatchItemError[] = []
    const validItems: CreateFrequentationDto[] = []
    // Field shapes are already guaranteed by the zod schema: only existence is checked here.
    frequentations.forEach((item, index) => {
      if (!knownIds.has(item.studentId)) {
        errors.push({ index, error: `Item ${index}: ${STUDENT_NOT_FOUND_ERROR}` })
      } else {
        validItems.push(item)
      }
    })

    if (validItems.length === 0) {
      return { success: true, data: { created: [], errors } }
    }

    const outcome = await gateway.createManyChecked(validItems, { allowDuplicates })
    if ('duplicates' in outcome) {
      const duplicates = await buildDuplicateWarnings(studentGateway, outcome.duplicates)
      return { success: true, data: { duplicates } }
    }
    return { success: true, data: { created: outcome.written, errors } }
  } catch (error) {
    const message = error instanceof Error ? error.message : UNKNOWN_ERROR
    return { success: false, error: message, code: ErrorCode.DATABASE_ERROR }
  }
}
