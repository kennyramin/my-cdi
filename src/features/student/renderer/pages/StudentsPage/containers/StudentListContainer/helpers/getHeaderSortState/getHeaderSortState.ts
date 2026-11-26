import type { StudentSortConfig, StudentSortField } from '@student/types'

export type AriaSort = 'ascending' | 'descending' | 'none'

export interface HeaderSortState {
  ariaSort: AriaSort
  iconName: 'arrow_upward' | 'arrow_downward' | 'unfold_more'
  isActive: boolean
}

const INACTIVE_STATE: HeaderSortState = {
  ariaSort: 'none',
  iconName: 'unfold_more',
  isActive: false
}

export function getHeaderSortState(
  config: StudentSortConfig,
  field: StudentSortField
): HeaderSortState {
  if (config.field !== field) {
    return INACTIVE_STATE
  }
  if (config.direction === 'asc') {
    return { ariaSort: 'ascending', iconName: 'arrow_upward', isActive: true }
  }
  return { ariaSort: 'descending', iconName: 'arrow_downward', isActive: true }
}
