import type { ExportRequestDto } from '@export-shared'
import type { ExportScopeProps } from '../../types/ExportScopeProps'
import type { StatisticsExportKind } from '../../types/StatisticsExportKind'

const JOURNAL_KIND: StatisticsExportKind = 'journal'

export function buildExportRequest(
  scope: ExportScopeProps,
  kind: StatisticsExportKind,
  includeNames: boolean
): ExportRequestDto {
  if (scope.scope === 'students') {
    return { kind: 'students', includeNames: false }
  }
  return { kind, period: scope.period, includeNames: kind === JOURNAL_KIND && includeNames }
}
