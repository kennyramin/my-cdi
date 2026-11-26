import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { CsvRemovalPreview } from '@student-shared'
import {
  RemovalConfirmField,
  RemovalMoreText,
  RemovalNameList,
  RemovalNote,
  RemovalPreviewHeading,
  RemovalSection,
  ResultAlert
} from './StudentCsvImportButtonPresenter.styles'

const NONE = 0
const MAX_LISTED_NAMES = 20

interface RemovalSectionPresenterProps {
  removeAbsent: boolean
  removalPreview: CsvRemovalPreview | null
  previewError: string | null
  confirmationText: string
  confirmationPhrase: string
  needsConfirmation: boolean
  isPending: boolean
  onToggle: () => void
  onConfirmationChange: (value: string) => void
}

export function RemovalSectionPresenter({
  removeAbsent,
  removalPreview,
  previewError,
  confirmationText,
  confirmationPhrase,
  needsConfirmation,
  isPending,
  onToggle,
  onConfirmationChange
}: RemovalSectionPresenterProps) {
  const { t } = useTranslation('student')

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onConfirmationChange(event.target.value)
  }

  const blockedReason = removalPreview?.blockedReason
  const listedNames = removalPreview ? removalPreview.sample.slice(NONE, MAX_LISTED_NAMES) : []
  const hiddenCount = removalPreview ? removalPreview.toRemove - listedNames.length : NONE
  const hasNamesToRemove =
    removalPreview !== null && blockedReason === undefined && removalPreview.toRemove > NONE

  return (
    <RemovalSection>
      <FormControlLabel
        control={<Checkbox checked={removeAbsent} onChange={onToggle} disabled={isPending} />}
        label={t('csvImport.removeAbsent')}
      />
      <RemovalNote variant="body2">{t('csvImport.removeAbsentHint')}</RemovalNote>

      {removeAbsent ? (
        <>
          <RemovalNote variant="body2">{t('anonymize.backupNote')}</RemovalNote>

          {previewError !== null ? (
            <ResultAlert severity="error">{previewError}</ResultAlert>
          ) : null}

          {blockedReason !== undefined ? (
            <ResultAlert severity="warning">
              {t(`csvImport.removalBlocked.${blockedReason}`)}
            </ResultAlert>
          ) : null}

          {removalPreview !== null && blockedReason === undefined && !hasNamesToRemove ? (
            <RemovalPreviewHeading variant="body2">
              {t('csvImport.removalNone')}
            </RemovalPreviewHeading>
          ) : null}

          {removalPreview !== null && hasNamesToRemove ? (
            <>
              <RemovalPreviewHeading variant="body2">
                {t('csvImport.removalPreview', {
                  count: removalPreview.toRemove,
                  total: removalPreview.total
                })}
              </RemovalPreviewHeading>
              <RemovalNameList>
                {listedNames.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </RemovalNameList>
              {hiddenCount > NONE ? (
                <RemovalMoreText variant="body2">
                  {t('csvImport.removalMore', { count: hiddenCount })}
                </RemovalMoreText>
              ) : null}
            </>
          ) : null}

          {hasNamesToRemove && needsConfirmation ? (
            <RemovalConfirmField
              fullWidth
              size="small"
              label={t('csvImport.removalConfirmLabel', { phrase: confirmationPhrase })}
              value={confirmationText}
              onChange={handleChange}
              disabled={isPending}
              autoComplete="off"
            />
          ) : null}
        </>
      ) : null}
    </RemovalSection>
  )
}
