import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarDayPresenter } from '../CalendarDayPresenter'
import type { CalendarCell } from '../../../../../helpers/buildCalendarMonth'

const DAY_OF_MONTH = 18

const CELL: CalendarCell = {
  iso: '2026-11-18',
  dayOfMonth: DAY_OF_MONTH,
  isCurrentMonth: true,
  isToday: false,
  isSelected: false,
  hasVisits: false
}

describe('CalendarDayPresenter', () => {
  it('forwards tabIndex, onFocus and onKeyDown to the button', () => {
    const onFocus = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <CalendarDayPresenter
        cell={CELL}
        tabIndex={-1}
        onClick={vi.fn()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    )
    const button = screen.getByRole('button', { name: '18' })
    expect(button.tabIndex).toBe(-1)
    fireEvent.keyDown(button, { key: 'ArrowRight' })
    fireEvent.focus(button)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
