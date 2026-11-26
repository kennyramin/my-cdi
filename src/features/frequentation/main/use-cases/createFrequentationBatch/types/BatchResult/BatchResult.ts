import type { FrequentationEntity } from '@frequentation/entities/frequentation'
import type { BatchItemErrorDto } from '@frequentation-shared'

export type BatchItemError = BatchItemErrorDto

export interface BatchResult {
  created: FrequentationEntity[]
  errors: BatchItemError[]
}
