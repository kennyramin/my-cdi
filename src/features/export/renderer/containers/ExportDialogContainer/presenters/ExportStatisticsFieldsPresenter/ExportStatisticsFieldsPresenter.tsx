import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Checkbox from '@mui/material/Checkbox'
import RadioGroup from '@mui/material/RadioGroup'
import {
  KIND_LEGEND_ID,
  KindFieldset,
  KindLegend,
  NAMES_HINT_ID,
  NamesField,
  NamesHint,
  NamesWarning,
  PeriodText
} from './ExportStatisticsFieldsPresenter.styles'

interface ExportStatisticsFieldsPresenterProps {
  periodLabel: string
  kind: string
  kindOptionNodes: ReactNode[]
  onKindChange: (event: unknown, value: string) => void
  includeNames: boolean
  canIncludeNames: boolean
  onIncludeNamesChange: (event: unknown, checked: boolean) => void
  isPending: boolean
}

export function ExportStatisticsFieldsPresenter({
  periodLabel,
  kind,
  kindOptionNodes,
  onKindChange,
  includeNames,
  canIncludeNames,
  onIncludeNamesChange,
  isPending
}: ExportStatisticsFieldsPresenterProps) {
  const { t } = useTranslation('export')

  return (
    <>
      <KindFieldset component="fieldset" disabled={isPending}>
        <KindLegend component="legend" id={KIND_LEGEND_ID}>
          {t('kind.legend')}
        </KindLegend>
        <RadioGroup aria-labelledby={KIND_LEGEND_ID} value={kind} onChange={onKindChange}>
          {kindOptionNodes}
        </RadioGroup>
      </KindFieldset>
      <PeriodText variant="body1">{periodLabel}</PeriodText>
      <NamesField
        control={
          <Checkbox
            checked={includeNames}
            onChange={onIncludeNamesChange}
            disabled={!canIncludeNames || isPending}
            slotProps={{ input: { 'aria-describedby': NAMES_HINT_ID } }}
          />
        }
        label={t('includeNames')}
      />
      <NamesHint id={NAMES_HINT_ID}>{t('includeNamesHint')}</NamesHint>
      {includeNames ? (
        <NamesWarning variant="body2" role="note">
          {t('namesWarning')}
        </NamesWarning>
      ) : null}
    </>
  )
}
