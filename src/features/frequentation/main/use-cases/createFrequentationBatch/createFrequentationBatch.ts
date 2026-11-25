import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { CreateFrequentationBatchDto } from '@frequentation-shared'
import { ErrorCode } from '@lib/errors'
import { isFutureLocalDateTime } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import type { BatchResult } from './types/BatchResult'
import { createFrequentationBatchSchema } from './validations/createFrequentationBatchSchema'
import { validateBatchItem } from './helpers/validateBatchItem'

const FUTURE_STARTS_AT_ERROR = 'startsAt cannot be in the future'

export async function createFrequentationBatch(
  gateway: FrequentationGateway,
  dto: CreateFrequentationBatchDto,
  now: Date = new Date()
): Promise<UseCaseResult<BatchResult>> {
  const parsed = createFrequentationBatchSchema.safeParse(dto)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  if (dto.frequentations.some((item) => isFutureLocalDateTime(item.startsAt, now))) {
    return { success: false, error: FUTURE_STARTS_AT_ERROR, code: ErrorCode.VALIDATION_ERROR }
  }

  const batch: BatchResult = { created: [], errors: [] }

  let index = 0
  for (const item of dto.frequentations) {
    const validation = validateBatchItem(item, index)

    if (!validation.valid) {
      batch.errors.push({ index, error: validation.error ?? 'Unknown validation error' })
      index += 1
      continue
    }

    try {
      const entity = await gateway.create(item)
      batch.created.push(entity)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      batch.errors.push({ index, error: message })
    }

    index += 1
  }

  return { success: true, data: batch }
}
