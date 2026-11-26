import type { JournalEntryViewModel } from '@frequentation/types'
import type { EditDraft } from '../../types/EditDraft'

const DATE_END = 10
const TIME_START = 11
const TIME_END = 16

export function buildEditDraft(entry: JournalEntryViewModel): EditDraft {
  return {
    date: entry.startsAt.slice(0, DATE_END),
    time: entry.startsAt.slice(TIME_START, TIME_END),
    studentId: entry.student.id,
    activity: entry.activity
  }
}
