import type { JournalEntryViewModel } from '@frequentation/types'
import { buildInitials, ANONYMOUS_INITIALS } from '@frequentation/helpers/buildInitials'

interface EntryAvatar {
  initials: string
  colorSeed: number | null
  neutral: boolean
}

export function getEntryAvatar(entry: JournalEntryViewModel): EntryAvatar {
  if (entry.isAnonymized) {
    return { initials: ANONYMOUS_INITIALS, colorSeed: null, neutral: true }
  }
  return {
    initials: buildInitials(entry.student.prenom, entry.student.nom),
    colorSeed: entry.student.id,
    neutral: false
  }
}
