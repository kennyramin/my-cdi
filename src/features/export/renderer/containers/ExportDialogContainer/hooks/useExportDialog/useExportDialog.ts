import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExportMutation } from '@export/api/useExportMutation'
import { isCancelledExport } from '@export-shared'
import type { ExportResultDto } from '@export-shared'
import { buildExportRequest } from '../../helpers/buildExportRequest'
import type { ExportDialogContainerProps } from '../../types/ExportDialogContainerProps'
import type { ExportScopeProps } from '../../types/ExportScopeProps'
import {
  DEFAULT_STATISTICS_EXPORT_KIND,
  isStatisticsExportKind
} from '../../types/StatisticsExportKind'
import type { StatisticsExportKind } from '../../types/StatisticsExportKind'

const JOURNAL_KIND: StatisticsExportKind = 'journal'

interface UseExportDialogOptions {
  scope: ExportScopeProps
  onClose: ExportDialogContainerProps['onClose']
  onResult: ExportDialogContainerProps['onResult']
}

export function useExportDialog({ scope, onClose, onResult }: UseExportDialogOptions) {
  const { t } = useTranslation('export')
  const [kind, setKind] = useState<StatisticsExportKind>(DEFAULT_STATISTICS_EXPORT_KIND)
  const [namesChecked, setNamesChecked] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const { mutate, isPending, error } = useExportMutation()
  const inFlightRef = useRef(false)

  const canIncludeNames = kind === JOURNAL_KIND
  const includeNames = canIncludeNames && namesChecked
  const canSubmit = scope.scope !== 'students' || acknowledged

  function onKindChange(_event: unknown, value: string) {
    if (isStatisticsExportKind(value)) {
      setKind(value)
      setNamesChecked(false)
    }
  }

  function onIncludeNamesChange(_event: unknown, checked: boolean) {
    setNamesChecked(checked)
  }

  function onAcknowledgeChange(_event: unknown, checked: boolean) {
    setAcknowledged(checked)
  }

  function handleSuccess(result: ExportResultDto) {
    if (!isCancelledExport(result)) {
      onResult(t('success', { count: result.rows }), 'success')
    }
    onClose()
  }

  function releaseInFlight() {
    inFlightRef.current = false
  }

  function submit() {
    if (inFlightRef.current || !canSubmit) {
      return
    }
    inFlightRef.current = true
    mutate(buildExportRequest(scope, kind, includeNames), {
      onSuccess: handleSuccess,
      onSettled: releaseInFlight
    })
  }

  function requestClose() {
    if (inFlightRef.current) {
      return
    }
    onClose()
  }

  return {
    kind,
    includeNames,
    canIncludeNames,
    acknowledged,
    canSubmit,
    isPending,
    errorMessage: error?.message ?? null,
    onKindChange,
    onIncludeNamesChange,
    onAcknowledgeChange,
    submit,
    requestClose
  } as const
}
