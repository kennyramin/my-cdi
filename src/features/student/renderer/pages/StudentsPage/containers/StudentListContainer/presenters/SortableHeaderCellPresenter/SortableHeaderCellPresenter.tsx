import type { HeaderSortState } from '../../helpers/getHeaderSortState'
import { SortHeaderButton, SortIcon } from './SortableHeaderCellPresenter.styles'
import { Icon } from '@ui/components/Icon'

export interface SortableHeaderCellPresenterProps {
  label: string
  sortState: HeaderSortState
  onSort: () => void
}

export function SortableHeaderCellPresenter({
  label,
  sortState,
  onSort
}: SortableHeaderCellPresenterProps) {
  return (
    <th aria-sort={sortState.ariaSort}>
      <SortHeaderButton type="button" onClick={onSort}>
        {label}
        <SortIcon data-active={sortState.isActive}>
          <Icon name={sortState.iconName} />
        </SortIcon>
      </SortHeaderButton>
    </th>
  )
}
