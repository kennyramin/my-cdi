import { describe, it, expect, vi } from 'vitest'
import dayjs from 'dayjs'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildCalendarMonth } from '../../../helpers/buildCalendarMonth'
import { useCalendarKeyboardNavigation } from '../useCalendarKeyboardNavigation'

const CELLS = buildCalendarMonth(dayjs('2026-11-01'), dayjs('2026-11-10'), '2026-11-18', new Set())

function Harness({ onSelect }: { onSelect: (iso: string) => void }) {
  const { tabbableIso, handleDayFocus, handleDayKeyDown } = useCalendarKeyboardNavigation(CELLS)
  return (
    <div>
      {CELLS.map((cell) => (
        <button
          key={cell.iso}
          type="button"
          data-iso={cell.iso}
          tabIndex={cell.iso === tabbableIso ? 0 : -1}
          onFocus={() => handleDayFocus(cell.iso)}
          onKeyDown={(event) => handleDayKeyDown(event, cell.iso)}
          onClick={() => onSelect(cell.iso)}
        >
          {cell.dayOfMonth}
        </button>
      ))}
    </div>
  )
}

function buttonFor(iso: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-iso="${iso}"]`)
  if (!found) {
    throw new Error(`missing ${iso}`)
  }
  return found
}

describe('useCalendarKeyboardNavigation', () => {
  it('only the selected day is tabbable', () => {
    render(<Harness onSelect={vi.fn()} />)
    const tabbable = screen.getAllByRole('button').filter((b) => b.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]?.getAttribute('data-iso')).toBe('2026-11-18')
  })

  it('ArrowRight moves focus to the next day', () => {
    render(<Harness onSelect={vi.fn()} />)
    const start = buttonFor('2026-11-18')
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-11-19')
    expect(buttonFor('2026-11-19').tabIndex).toBe(0)
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0)).toHaveLength(1)
  })

  it('ArrowDown moves by one week', () => {
    render(<Harness onSelect={vi.fn()} />)
    const start = buttonFor('2026-11-18')
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-11-25')
  })

  it('ignores moves that leave the rendered grid', () => {
    render(<Harness onSelect={vi.fn()} />)
    const last = buttonFor(CELLS[CELLS.length - 1]?.iso ?? '')
    last.focus()
    expect(() => fireEvent.keyDown(last, { key: 'ArrowDown' })).not.toThrow()
    expect(document.activeElement).toBe(last)
  })

  it('selects the focused day with Enter', async () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    buttonFor('2026-11-18').focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('2026-11-18')
  })
})
