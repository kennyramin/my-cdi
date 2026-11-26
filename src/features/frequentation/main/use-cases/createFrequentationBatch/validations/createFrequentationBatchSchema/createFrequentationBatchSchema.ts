import { z } from 'zod'
import {
  activitySchema,
  startsAtSchema,
  studentIdSchema
} from '../../../helpers/frequentationFieldSchemas'

export const MAX_BATCH_SIZE = 100

const createFrequentationItemSchema = z.object({
  startsAt: startsAtSchema,
  activity: activitySchema,
  studentId: studentIdSchema
})

export const createFrequentationBatchSchema = z.object({
  frequentations: z.array(createFrequentationItemSchema).min(1).max(MAX_BATCH_SIZE),
  allowDuplicates: z.boolean().optional()
})
