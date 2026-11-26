import type { JournalEntryViewModel } from '@frequentation/types'
import type { UpdateFrequentationDto } from '@frequentation-shared'
import type { EditDraft } from '../../types/EditDraft'

const SECONDS_SUFFIX = ':00'
const MINUTE_PRECISION_END = 16

export function buildEditPayload(
  entry: JournalEntryViewModel,
  draft: EditDraft,
  allowDuplicates: boolean
): { id: number } & UpdateFrequentationDto {
  const minuteStart = `${draft.date}T${draft.time}`
  // Compared at minute precision so an untouched date/time keeps the stored seconds.
  const startsAtChanged = minuteStart !== entry.startsAt.slice(0, MINUTE_PRECISION_END)
  const { studentId } = draft
  const studentChanged = !entry.isAnonymized && studentId !== null && studentId !== entry.student.id
  return {
    id: entry.id,
    activity: draft.activity,
    ...(startsAtChanged && { startsAt: `${minuteStart}${SECONDS_SUFFIX}` }),
    ...(studentChanged && { studentId }),
    ...(allowDuplicates && { allowDuplicates })
  }
}
