export const STATISTICS_EXPORT_KINDS = [
  'journal',
  'visitsByDay',
  'visitsByActivity',
  'visitsByClass'
] as const

export type StatisticsExportKind = (typeof STATISTICS_EXPORT_KINDS)[number]

export const DEFAULT_STATISTICS_EXPORT_KIND: StatisticsExportKind = 'journal'

export function isStatisticsExportKind(value: string): value is StatisticsExportKind {
  return STATISTICS_EXPORT_KINDS.some((kind) => kind === value)
}
