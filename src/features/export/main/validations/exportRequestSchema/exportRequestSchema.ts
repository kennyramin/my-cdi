import { z } from 'zod'
import { EXPORT_KINDS, type ExportKind, type ExportRequestDto } from '@export-shared'

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const AGGREGATED_KINDS: readonly ExportKind[] = ['visitsByDay', 'visitsByActivity', 'visitsByClass']

function isRealCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const isoDateSchema = z.string().refine(isRealCalendarDate)

const periodSchema = z.object({ startDate: isoDateSchema, endDate: isoDateSchema })

export const exportRequestSchema = z
  .object({
    kind: z.enum(EXPORT_KINDS),
    period: periodSchema.optional(),
    includeNames: z.boolean().default(false),
    acknowledgedPersonalData: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.kind === 'students') {
      if (value.acknowledgedPersonalData !== true) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['acknowledgedPersonalData'] })
      }
      return
    }
    if (value.period === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['period'] })
      return
    }
    if (value.period.startDate > value.period.endDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['period'] })
    }
  })
  .transform((value): ExportRequestDto => {
    if (value.kind === 'students') {
      return {
        kind: value.kind,
        includeNames: true,
        acknowledgedPersonalData: true
      }
    }
    return {
      kind: value.kind,
      period: value.period,
      includeNames: AGGREGATED_KINDS.includes(value.kind) ? false : value.includeNames
    }
  })
