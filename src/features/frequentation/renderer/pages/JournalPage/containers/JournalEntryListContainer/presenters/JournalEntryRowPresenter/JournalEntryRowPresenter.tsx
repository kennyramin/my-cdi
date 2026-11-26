import { useTranslation } from 'react-i18next'
import { Avatar } from '@ui/components/Avatar'
import { IconButton } from '@ui/components/IconButton'
import type { ActivityTone } from '@ui/theme'
import { ActivityChipPresenter } from '@frequentation/presenters/ActivityChipPresenter'
import {
  ACTIONS_CLASS,
  ClasseTag,
  MetaRow,
  PeriodTag,
  Row,
  RowActions,
  RowCheckbox,
  RowMain,
  StudentName,
  TimeText
} from './JournalEntryRowPresenter.styles'

export interface JournalEntryRowPresenterProps {
  initials: string
  avatarColorSeed: number | null
  isAnonymized: boolean
  displayName: string
  classe: string
  time: string
  periodLabel: string
  period: 'morning' | 'afternoon'
  activityTone: ActivityTone
  activityLabel: string
  selected: boolean
  onSelectChange: () => void
  onRowClick: (event: React.MouseEvent) => void
  onEditClick: (event: React.MouseEvent) => void
  onDeleteClick: (event: React.MouseEvent) => void
}

export function JournalEntryRowPresenter({
  initials,
  avatarColorSeed,
  isAnonymized,
  displayName,
  classe,
  time,
  periodLabel,
  period,
  activityTone,
  activityLabel,
  selected,
  onSelectChange,
  onRowClick,
  onEditClick,
  onDeleteClick
}: JournalEntryRowPresenterProps) {
  const { t } = useTranslation('frequentation')
  const selectLabel = isAnonymized
    ? t('row.selectAnonymized', { classe, time })
    : t('row.select', { name: displayName })

  return (
    <Row onClick={onRowClick} $isSelected={selected}>
      <RowCheckbox
        size="small"
        checked={selected}
        onChange={onSelectChange}
        onClick={(event) => event.stopPropagation()}
        slotProps={{ input: { 'aria-label': selectLabel } }}
      />
      <Avatar initials={initials} colorSeed={avatarColorSeed} neutral={isAnonymized} />
      <RowMain>
        <StudentName>
          {displayName}
          <ClasseTag>{classe}</ClasseTag>
        </StudentName>
        <MetaRow>
          <TimeText>{time}</TimeText>
          <PeriodTag variant="overline" $period={period} data-period={period}>
            {periodLabel}
          </PeriodTag>
          <ActivityChipPresenter tone={activityTone} label={activityLabel} />
        </MetaRow>
      </RowMain>
      <RowActions className={ACTIONS_CLASS}>
        <IconButton iconName="edit" aria-label={t('row.edit')} onClick={onEditClick} />
        <IconButton
          iconName="delete"
          tone="danger"
          aria-label={t('row.delete')}
          onClick={onDeleteClick}
        />
      </RowActions>
    </Row>
  )
}
