import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import dayjs from 'dayjs'
import { Button } from '@ui/components/Button'
import { Icon } from '@ui/components/Icon'
import { Toast } from '@ui/components/Toast'
import { useTypeToSearch } from '@ui/hooks/useTypeToSearch'
import { DuplicateWarningDialogPresenter } from '@frequentation/presenters/DuplicateWarningDialogPresenter'
import { ActivityGridPresenter } from '@frequentation/presenters/ActivityGridPresenter'
import { buildActivityTiles } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTiles'
import { buildActivityTileNodes } from '@frequentation/presenters/ActivityGridPresenter/helpers/buildActivityTileNodes'
import { useJournalEntryForm } from './hooks/useJournalEntryForm'
import { StudentMultiSelectPresenter } from './presenters/StudentMultiSelectPresenter'
import { Chip } from '@ui/components/Chip'
import type { AutocompleteOption } from '@ui/components/Autocomplete'
import { TimeRowPresenter } from './presenters/TimeRowPresenter'
import { periodFromTime } from './presenters/TimeRowPresenter/helpers/periodFromTime'

import {
  EntryForm,
  FutureDateHelperText,
  SUBMIT_BAR_ATTRIBUTE,
  SectionLabel,
  FormCard,
  SubmitBar
} from './JournalEntryFormContainer.styles'

const TIME_FORMAT = 'HH:mm'
const FUTURE_DATE_HELPER_ID = 'journal-future-date-helper'

interface StudentChip {
  id: number
  label: string
  onRemove: () => void
}

interface JournalEntryFormContainerProps {
  selectedDate: string
  onSubmitted?: () => void
}

export function JournalEntryFormContainer({
  selectedDate,
  onSubmitted
}: JournalEntryFormContainerProps) {
  const { t } = useTranslation('frequentation')
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  useTypeToSearch(searchInputRef)
  const {
    form,
    handleSubmit,
    activityOptions,
    studentOptions,
    studentInputValue,
    setStudentInputValue,
    handleStudentSelect,
    handleStudentRemove,
    isStudentLoading,
    isFutureDate,
    isSubmitting,
    pendingDuplicates,
    confirmDuplicates,
    cancelDuplicates,
    getActivityLabel,
    toast,
    dismissToast
  } = useJournalEntryForm({ selectedDate, onSubmitted })

  const isDisabled = isSubmitting || !form.formState.isValid || isFutureDate

  function buildStudentChips(selectedIds: number[]): StudentChip[] {
    return studentOptions
      .filter((student) => selectedIds.includes(student.id))
      .map((student) => ({
        id: student.id,
        label: student.displayName,
        onRemove: () => {
          handleStudentRemove(selectedIds, student.id)
        }
      }))
  }

  function buildStudentOptions(): AutocompleteOption<number>[] {
    return studentOptions.map((student) => ({
      value: student.id,
      label: student.displayName,
      badge: student.classe
    }))
  }

  function buildStudentChipNodes(selectedIds: number[]): ReactNode[] {
    return buildStudentChips(selectedIds).map((chip) => (
      <Chip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
    ))
  }

  return (
    <FormCard>
      <SectionLabel variant="overline">{t('form.newEntry')}</SectionLabel>
      <Controller
        control={form.control}
        name="time"
        render={({ field }) => {
          const dateValue = dayjs(`2000-01-01T${field.value}`)
          const period = periodFromTime(field.value)
          return (
            <TimeRowPresenter
              value={field.value}
              dateValue={dateValue}
              periodLabel={period === 'morning' ? t('period.morning') : t('period.afternoon')}
              onCommit={(next) => {
                if (next !== null) {
                  field.onChange(next.format(TIME_FORMAT))
                }
              }}
              ariaLabel={t('form.startsAt')}
              open={timePickerOpen}
              onOpen={() => setTimePickerOpen(true)}
              onClose={() => setTimePickerOpen(false)}
            />
          )
        }}
      />
      <EntryForm onSubmit={form.handleSubmit(handleSubmit)}>
        <Controller
          control={form.control}
          name="studentIds"
          render={({ field }) => (
            <StudentMultiSelectPresenter
              options={buildStudentOptions()}
              selectedIds={field.value}
              chipNodes={buildStudentChipNodes(field.value)}
              inputValue={studentInputValue}
              onInputChange={setStudentInputValue}
              onSelect={(option) => handleStudentSelect(field.value, option.value)}
              loading={isStudentLoading}
              inputRef={searchInputRef}
            />
          )}
        />
        <Controller
          control={form.control}
          name="activity"
          render={({ field }) => (
            <ActivityGridPresenter
              tileNodes={buildActivityTileNodes(
                buildActivityTiles(activityOptions, field.value, field.onChange)
              )}
            />
          )}
        />
        <SubmitBar {...{ [SUBMIT_BAR_ATTRIBUTE]: '' }}>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isDisabled}
            aria-describedby={isFutureDate ? FUTURE_DATE_HELPER_ID : undefined}
            iconLeft={<Icon name="check_circle" />}
          >
            {t('form.submit')}
          </Button>
          {isFutureDate && (
            <FutureDateHelperText id={FUTURE_DATE_HELPER_ID} variant="caption" role="status">
              {t('form.futureNotAllowed')}
            </FutureDateHelperText>
          )}
        </SubmitBar>
      </EntryForm>
      <DuplicateWarningDialogPresenter
        duplicates={pendingDuplicates}
        onConfirm={confirmDuplicates}
        onCancel={cancelDuplicates}
        getActivityLabel={getActivityLabel}
      />
      <Toast toast={toast} onClose={dismissToast} />
    </FormCard>
  )
}
