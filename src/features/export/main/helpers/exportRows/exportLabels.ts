import { ActivityType } from '@types'

export const ACTIVITY_EXPORT_LABELS: Record<ActivityType, string> = {
  [ActivityType.WORK]: 'Travail',
  [ActivityType.READING]: 'Lecture',
  [ActivityType.COMPUTER]: 'Ordinateur',
  [ActivityType.RELAXATION]: 'Détente',
  [ActivityType.GAME]: 'Jeu de société',
  [ActivityType.OTHER]: 'Autre'
}
