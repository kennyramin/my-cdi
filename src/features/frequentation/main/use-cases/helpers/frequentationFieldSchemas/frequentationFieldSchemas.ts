import { z } from 'zod'
import { LOCAL_DATE_TIME_PATTERN } from '@lib/localDateTime'
import { ActivityType } from '@types'

export const startsAtSchema = z.string().regex(LOCAL_DATE_TIME_PATTERN)
export const activitySchema = z.nativeEnum(ActivityType)
export const studentIdSchema = z.number().int().positive().safe()
