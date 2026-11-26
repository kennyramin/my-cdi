import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader } from '@ui/components/Loader'
import { useCalendar } from './hooks/useCalendar'
import { useMonthEntryCounts } from './hooks/useMonthEntryCounts'
import { useCalendarKeyboardNavigation } from './hooks/useCalendarKeyboardNavigation'
import { buildCalendarMonth } from './helpers/buildCalendarMonth'
import { CalendarDayPresenter } from './presenters/CalendarViewPresenter/presenters/CalendarDayPresenter'
import { CalendarViewPresenter } from './presenters/CalendarViewPresenter'
import { CalendarLoading, WeekdayLabel } from './CalendarContainer.styles'
import type { CalendarContainerProps } from './types/CalendarContainerProps'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function CalendarContainer({ selectedDate, onSelectDate }: CalendarContainerProps) {
  const { t } = useTranslation('frequentation')
  const { viewMonth, monthLabel, goToPrevMonth, goToNextMonth, goToToday, selectDay } = useCalendar(
    {
      selectedDate,
      onSelectDate
    }
  )
  const { daysWithVisits, isLoading } = useMonthEntryCounts(viewMonth)
  const cells = buildCalendarMonth(viewMonth, dayjs(), selectedDate, daysWithVisits)
  const { tabbableIso, handleDayFocus, handleDayKeyDown } = useCalendarKeyboardNavigation(cells)

  if (isLoading) {
    return (
      <CalendarLoading>
        <Loader message={t('loading')} />
      </CalendarLoading>
    )
  }

  const weekdayNodes: ReactNode[] = WEEKDAY_LABELS.map((label) => (
    <WeekdayLabel key={label} variant="overline">
      {label}
    </WeekdayLabel>
  ))
  const dayNodes: ReactNode[] = cells.map((cell) => (
    <CalendarDayPresenter
      key={cell.iso}
      cell={cell}
      tabIndex={cell.iso === tabbableIso ? 0 : -1}
      onClick={() => {
        selectDay(cell.iso)
      }}
      onFocus={() => {
        handleDayFocus(cell.iso)
      }}
      onKeyDown={(event) => {
        handleDayKeyDown(event, cell.iso)
      }}
    />
  ))

  return (
    <CalendarViewPresenter
      monthLabel={monthLabel}
      weekdayNodes={weekdayNodes}
      dayNodes={dayNodes}
      onPrev={goToPrevMonth}
      onNext={goToNextMonth}
      onToday={goToToday}
      prevLabel={t('calendar.previousMonth')}
      todayLabel={t('calendar.today')}
      nextLabel={t('calendar.nextMonth')}
    />
  )
}
