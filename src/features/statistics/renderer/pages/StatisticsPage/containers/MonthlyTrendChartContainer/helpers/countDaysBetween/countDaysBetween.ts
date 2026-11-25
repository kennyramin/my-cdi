const MS_PER_DAY = 86_400_000

function toLocalDate(isoDate: string): Date {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function countDaysBetween(startDate: string, endDate: string): number {
  return Math.round(
    (toLocalDate(endDate).getTime() - toLocalDate(startDate).getTime()) / MS_PER_DAY
  )
}
