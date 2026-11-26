import type { ActivityType } from '@types'
import { localSameDayDistanceSeconds } from '@lib/localDateTime'
import { DUPLICATE_WINDOW_SECONDS } from '@frequentation-shared'
import type { DuplicateMatch } from '../../frequentation.gateway'

export interface DuplicateCandidate {
  studentId: number
  startsAt: string
}

export interface ExistingVisit {
  id: number
  studentId: number | null
  startsAt: string
  activity: ActivityType
}

export function findDuplicateMatches(
  candidates: DuplicateCandidate[],
  existing: ExistingVisit[],
  excludeId?: number
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = []
  for (const candidate of candidates) {
    for (const visit of existing) {
      if (visit.studentId !== candidate.studentId || visit.id === excludeId) {
        continue
      }
      const distance = localSameDayDistanceSeconds(candidate.startsAt, visit.startsAt)
      if (distance !== null && distance < DUPLICATE_WINDOW_SECONDS) {
        matches.push({
          studentId: candidate.studentId,
          existingId: visit.id,
          existingStartsAt: visit.startsAt,
          existingActivity: visit.activity
        })
      }
    }
  }
  return matches
}
