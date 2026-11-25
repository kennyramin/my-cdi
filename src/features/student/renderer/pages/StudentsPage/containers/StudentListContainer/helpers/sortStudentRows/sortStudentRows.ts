import type {
  StudentViewModel,
  StudentSortConfig,
  StudentSortField,
  SortDirection
} from '@student/types'

const COLLATOR = new Intl.Collator('fr', { sensitivity: 'base' })

function compareValues(a: StudentViewModel, b: StudentViewModel, field: StudentSortField): number {
  if (field === 'visitCount') {
    return a.visitCount - b.visitCount
  }
  return COLLATOR.compare(a[field], b[field])
}

function compareByField(field: StudentSortField, direction: SortDirection) {
  return (a: StudentViewModel, b: StudentViewModel): number => {
    const comparison = compareValues(a, b, field)
    return direction === 'asc' ? comparison : -comparison
  }
}

export function sortStudentRows(
  students: StudentViewModel[],
  config: StudentSortConfig
): StudentViewModel[] {
  return [...students].sort(compareByField(config.field, config.direction))
}
