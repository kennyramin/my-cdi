import type { ReactNode } from 'react'
import {
  EmptyCell,
  TableElement,
  TableFooter,
  TableRoot,
  TableScroll
} from './StudentTablePresenter.styles'

export interface StudentTablePresenterProps {
  headerNodes: ReactNode[]
  rowNodes: ReactNode[]
  countLabel: string
  emptyMessage: string | null
}

export function StudentTablePresenter({
  headerNodes,
  rowNodes,
  countLabel,
  emptyMessage
}: StudentTablePresenterProps) {
  return (
    <TableRoot>
      <TableScroll>
        <TableElement>
          <thead>
            <tr>{headerNodes}</tr>
          </thead>
          <tbody>
            {rowNodes.length === 0 && emptyMessage !== null ? (
              <tr>
                <EmptyCell colSpan={headerNodes.length}>{emptyMessage}</EmptyCell>
              </tr>
            ) : (
              rowNodes
            )}
          </tbody>
        </TableElement>
      </TableScroll>
      <TableFooter>
        <span>{countLabel}</span>
      </TableFooter>
    </TableRoot>
  )
}
