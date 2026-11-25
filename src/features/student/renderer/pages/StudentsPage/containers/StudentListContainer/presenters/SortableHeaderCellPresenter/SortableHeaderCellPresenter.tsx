import type { CSSProperties } from 'react'
import type { HeaderSortState } from '../../helpers/getHeaderSortState'
import { SortHeaderButton, SortIcon } from './SortableHeaderCellPresenter.styles'
import { Icon } from '@ui/components/Icon'

export interface SortableHeaderCellPresenterProps {
  label: string
  sortState: HeaderSortState
  onSort: () => void
  style?: CSSProperties
}

export function SortableHeaderCellPresenter({
  label,
  sortState,
  onSort,
  style
}: SortableHeaderCellPresenterProps) {
  return (
    <th aria-sort={sortState.ariaSort} style={style}>
      <SortHeaderButton type="button" onClick={onSort}>
        {label}
        <SortIcon data-active={sortState.isActive}>
          <Icon name={sortState.iconName} />
        </SortIcon>
      </SortHeaderButton>
    </th>
  )
}
