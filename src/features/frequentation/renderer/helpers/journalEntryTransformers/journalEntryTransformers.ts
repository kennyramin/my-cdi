import type { JournalEntryDto } from '@frequentation-shared'
import type { ActivityType } from '@types'
import type { ActivityTone } from '@ui/theme'
import type { JournalEntryViewModel } from '@frequentation/types'
import { getActivityColor } from '@frequentation/helpers/activityFormatters'

const DISPLAY_NAME_SEPARATOR = ' '

function buildStudent(
  dto: JournalEntryDto,
  anonymizedLabel: string
): JournalEntryViewModel['student'] {
  if (dto.student === null) {
    return {
      id: null,
      nom: '',
      prenom: '',
      classe: dto.frequentation.studentClass,
      ine: '',
      displayName: anonymizedLabel
    }
  }
  return {
    ...dto.student,
    displayName: `${dto.student.prenom.trim()}${DISPLAY_NAME_SEPARATOR}${dto.student.nom.trim()}`
  }
}

export function toJournalEntryViewModel(
  dto: JournalEntryDto,
  activityLabelLookup: (activity: ActivityType) => string,
  activityColors: Record<ActivityTone, string>,
  anonymizedLabel: string
): JournalEntryViewModel {
  return {
    id: dto.frequentation.id,
    startsAt: dto.frequentation.startsAt,
    activity: dto.frequentation.activity,
    isAnonymized: dto.student === null,
    student: buildStudent(dto, anonymizedLabel),
    activityLabel: activityLabelLookup(dto.frequentation.activity),
    activityColor: getActivityColor(dto.frequentation.activity, activityColors)
  }
}
