import type { StudentSortConfig, StudentSortField } from '@student/types'

const DESCENDING_FIRST_FIELD: StudentSortField = 'visitCount'

export function buildNextSortConfig(
  current: StudentSortConfig,
  field: StudentSortField
): StudentSortConfig {
  const isCurrentField = current.field === field
  if (isCurrentField) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  const direction = field === DESCENDING_FIRST_FIELD ? 'desc' : 'asc'
  return { field, direction }
}
