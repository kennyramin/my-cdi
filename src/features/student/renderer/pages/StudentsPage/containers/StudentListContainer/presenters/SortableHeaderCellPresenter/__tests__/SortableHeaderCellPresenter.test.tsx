import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import { SortableHeaderCellPresenter } from '../SortableHeaderCellPresenter'
import type { HeaderSortState } from '../../../helpers/getHeaderSortState'

const ACTIVE_STATE: HeaderSortState = {
  ariaSort: 'ascending',
  iconName: 'arrow_upward',
  isActive: true
}
const INACTIVE_STATE: HeaderSortState = {
  ariaSort: 'none',
  iconName: 'unfold_more',
  isActive: false
}

function renderCell(sortState: HeaderSortState, onSort = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <table>
        <thead>
          <tr>
            <SortableHeaderCellPresenter label="Nom" sortState={sortState} onSort={onSort} />
          </tr>
        </thead>
      </table>
    </ThemeProvider>
  )
  return onSort
}

describe('SortableHeaderCellPresenter', () => {
  it('exposes aria-sort on the column header', () => {
    renderCell(ACTIVE_STATE)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('renders a button named after the label', () => {
    renderCell(ACTIVE_STATE)
    expect(screen.getByRole('button', { name: 'Nom' })).toBeInTheDocument()
  })

  it('calls onSort when Enter is pressed on the focused button', async () => {
    const user = userEvent.setup()
    const onSort = renderCell(ACTIVE_STATE)
    screen.getByRole('button', { name: 'Nom' }).focus()
    await user.keyboard('{Enter}')
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('renders the dimmed unfold icon when inactive', () => {
    renderCell(INACTIVE_STATE)
    const icon = screen.getByText('unfold_more').closest('[data-active]')
    expect(icon).toHaveAttribute('data-active', 'false')
  })
})
