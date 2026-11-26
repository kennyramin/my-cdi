import { useTranslation } from 'react-i18next'
import type { ChangeEventHandler } from 'react'
import TextField from '@mui/material/TextField'
import { Autocomplete } from '@ui/components/Autocomplete'
import type { AutocompleteOption } from '@ui/components/Autocomplete'
import {
  DateTimeRow,
  FieldsWrapper,
  HelperText,
  StudentField,
  StudentLabel
} from './EditEntryFieldsPresenter.styles'

interface EditEntryFieldsPresenterProps {
  date: string
  time: string
  maxDate: string
  /** Translated issue with the date/time (future or missing), null when valid. */
  dateTimeMessage: string | null
  dateTimeHelperId: string
  onDateChange: ChangeEventHandler<HTMLInputElement>
  onTimeChange: ChangeEventHandler<HTMLInputElement>
  studentOptions: AutocompleteOption<number>[]
  studentInputValue: string
  onStudentInputChange: (next: string) => void
  onStudentSelect: (option: AutocompleteOption<number>) => void
  studentLocked: boolean
  /** Translated "select a student" message, null when the text matches the selection. */
  studentMessage: string | null
  studentInputId: string
  studentHelperId: string
}

export function EditEntryFieldsPresenter({
  date,
  time,
  maxDate,
  dateTimeMessage,
  dateTimeHelperId,
  onDateChange,
  onTimeChange,
  studentOptions,
  studentInputValue,
  onStudentInputChange,
  onStudentSelect,
  studentLocked,
  studentMessage,
  studentInputId,
  studentHelperId
}: EditEntryFieldsPresenterProps) {
  const { t } = useTranslation('frequentation')
  const dateTimeDescribedBy = dateTimeMessage ? dateTimeHelperId : undefined
  const studentDescribedBy = studentLocked || studentMessage ? studentHelperId : undefined

  return (
    <FieldsWrapper>
      <DateTimeRow>
        <TextField
          type="date"
          size="small"
          label={t('edit.date')}
          value={date}
          error={Boolean(dateTimeMessage)}
          onChange={onDateChange}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: maxDate, 'aria-describedby': dateTimeDescribedBy }
          }}
        />
        <TextField
          type="time"
          size="small"
          label={t('edit.time')}
          value={time}
          error={Boolean(dateTimeMessage)}
          onChange={onTimeChange}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-describedby': dateTimeDescribedBy }
          }}
        />
      </DateTimeRow>
      {dateTimeMessage ? (
        <HelperText id={dateTimeHelperId} variant="caption" role="alert">
          {dateTimeMessage}
        </HelperText>
      ) : null}
      <StudentField>
        <StudentLabel htmlFor={studentInputId}>{t('edit.student')}</StudentLabel>
        <Autocomplete
          inputId={studentInputId}
          ariaDescribedBy={studentDescribedBy}
          invalid={Boolean(studentMessage)}
          options={studentOptions}
          onSelect={onStudentSelect}
          inputValue={studentInputValue}
          onInputChange={onStudentInputChange}
          clearInputOnSelect={false}
          disabled={studentLocked}
        />
        {studentLocked ? (
          <HelperText id={studentHelperId} variant="caption">
            {t('edit.anonymizedStudentLocked')}
          </HelperText>
        ) : null}
        {studentMessage ? (
          <HelperText id={studentHelperId} variant="caption" role="alert">
            {studentMessage}
          </HelperText>
        ) : null}
      </StudentField>
    </FieldsWrapper>
  )
}
