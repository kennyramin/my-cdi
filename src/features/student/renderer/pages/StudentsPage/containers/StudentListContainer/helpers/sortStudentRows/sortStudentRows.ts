import type {
  StudentViewModel,
  StudentSortConfig,
  StudentSortField,
  SortDirection
} from '@student/types'

const NO_DIFFERENCE = 0
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
    if (comparison !== NO_DIFFERENCE) {
      return direction === 'asc' ? comparison : -comparison
    }
    return COLLATOR.compare(a.nom, b.nom) || COLLATOR.compare(a.prenom, b.prenom)
  }
}

export function sortStudentRows(
  students: StudentViewModel[],
  config: StudentSortConfig
): StudentViewModel[] {
  return [...students].sort(compareByField(config.field, config.direction))
}
