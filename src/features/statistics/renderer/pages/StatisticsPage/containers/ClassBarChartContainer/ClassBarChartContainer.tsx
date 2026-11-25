import { useTranslation } from 'react-i18next'
import { EmptyState } from '@ui/components/EmptyState'
import { ChartCardPresenter } from '@statistics/presenters/ChartCardPresenter'
import {
  ClassBarList,
  ClassBarRow,
  ClassFill,
  ClassLabel,
  ClassTrack,
  ClassValue
} from './ClassBarChartContainer.styles'
import { buildClassBars } from './helpers/buildClassBars'
import type { ClassBarChartContainerProps } from './types/ClassBarChartContainerProps'

export function ClassBarChartContainer({ classCounts }: ClassBarChartContainerProps) {
  const { t } = useTranslation('statistics')
  const bars = buildClassBars(classCounts)
  return (
    <ChartCardPresenter titleIcon="groups" title={t('charts.classes')}>
      {bars.length === 0 ? (
        <EmptyState iconName="groups" message={t('charts.classesEmpty')} />
      ) : (
        <ClassBarList>
          {bars.map((bar) => (
            <ClassBarRow key={bar.classe}>
              <ClassLabel variant="body2">{bar.classe}</ClassLabel>
              <ClassTrack aria-hidden="true">
                <ClassFill $widthPercent={bar.widthPercent} />
              </ClassTrack>
              <ClassValue variant="body2">{bar.count}</ClassValue>
            </ClassBarRow>
          ))}
        </ClassBarList>
      )}
    </ChartCardPresenter>
  )
}
