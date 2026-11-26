import { useTranslation } from 'react-i18next'
import { formatDate } from '@ui/helpers/formatDate'
import { useExportDialog } from './hooks/useExportDialog'
import { ExportDialogPresenter } from './presenters/ExportDialogPresenter'
import { ExportKindOptionPresenter } from './presenters/ExportKindOptionPresenter'
import { STATISTICS_EXPORT_KINDS } from './types/StatisticsExportKind'
import type { StatisticsExportKind } from './types/StatisticsExportKind'
import type { ExportDialogContainerProps } from './types/ExportDialogContainerProps'

const KIND_LABEL_KEYS: Record<StatisticsExportKind, string> = {
  journal: 'kind.journal',
  visitsByDay: 'kind.visitsByDay',
  visitsByActivity: 'kind.visitsByActivity',
  visitsByClass: 'kind.visitsByClass'
}

export function ExportDialogContainer(props: ExportDialogContainerProps) {
  const { t } = useTranslation('export')
  const dialog = useExportDialog({
    scope: props,
    onClose: props.onClose,
    onResult: props.onResult
  })

  if (props.scope === 'students') {
    return null
  }

  const kindOptionNodes = STATISTICS_EXPORT_KINDS.map((kind) => (
    <ExportKindOptionPresenter key={kind} value={kind} label={t(KIND_LABEL_KEYS[kind])} />
  ))
  const periodLabel = t('period', {
    start: formatDate(props.period.startDate),
    end: formatDate(props.period.endDate)
  })

  return (
    <ExportDialogPresenter
      open={props.open}
      title={t('title.statistics')}
      periodLabel={periodLabel}
      kind={dialog.kind}
      kindOptionNodes={kindOptionNodes}
      onKindChange={dialog.onKindChange}
      includeNames={dialog.includeNames}
      canIncludeNames={dialog.canIncludeNames}
      onIncludeNamesChange={dialog.onIncludeNamesChange}
      isPending={dialog.isPending}
      errorMessage={dialog.errorMessage}
      onConfirm={dialog.submit}
      onCancel={dialog.requestClose}
      onClose={dialog.requestClose}
    />
  )
}
