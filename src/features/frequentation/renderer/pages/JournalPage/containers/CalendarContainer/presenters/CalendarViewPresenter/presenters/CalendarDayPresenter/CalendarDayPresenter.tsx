import type { KeyboardEvent } from 'react'
import type { CalendarCell } from '../../../../helpers/buildCalendarMonth'
import { DayCell } from './CalendarDayPresenter.styles'

interface CalendarDayPresenterProps {
  cell: CalendarCell
  tabIndex: number
  onClick: () => void
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function CalendarDayPresenter({
  cell,
  tabIndex,
  onClick,
  onFocus,
  onKeyDown
}: CalendarDayPresenterProps) {
  return (
    <DayCell
      type="button"
      data-iso={cell.iso}
      data-current-month={cell.isCurrentMonth}
      data-today={cell.isToday}
      data-selected={cell.isSelected}
      data-has-visits={cell.hasVisits}
      tabIndex={tabIndex}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {cell.dayOfMonth}
    </DayCell>
  )
}
