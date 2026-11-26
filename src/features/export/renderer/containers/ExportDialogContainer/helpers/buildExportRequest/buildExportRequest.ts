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
    // The acknowledgement gate lives in useExportDialog (submit is a no-op until checked) and in
    // the disabled Exporter button; the main process re-enforces it on acknowledgedPersonalData.
    return { kind: 'students', includeNames: true, acknowledgedPersonalData: true }
  }
  return { kind, period: scope.period, includeNames: kind === JOURNAL_KIND && includeNames }
}
