import type { CalendarCell } from '../buildCalendarMonth'

export function resolveTabbableDay(cells: CalendarCell[], focusedIso: string | null): string {
  const focused = cells.find((cell) => cell.iso === focusedIso)
  const candidate =
    focused ??
    cells.find((cell) => cell.isSelected) ??
    cells.find((cell) => cell.isToday) ??
    cells.find((cell) => cell.isCurrentMonth)
  return candidate?.iso ?? ''
}
