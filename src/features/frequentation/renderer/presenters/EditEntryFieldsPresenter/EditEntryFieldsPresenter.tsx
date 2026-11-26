import { useId } from 'react'
import { useTranslation } from 'react-i18next'
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
  isFuture: boolean
  onDateChange: (next: string) => void
  onTimeChange: (next: string) => void
  studentOptions: AutocompleteOption<number>[]
  studentInputValue: string
  onStudentInputChange: (next: string) => void
  onStudentSelect: (option: AutocompleteOption<number>) => void
  studentLocked: boolean
}

export function EditEntryFieldsPresenter({
  date,
  time,
  maxDate,
  isFuture,
  onDateChange,
  onTimeChange,
  studentOptions,
  studentInputValue,
  onStudentInputChange,
  onStudentSelect,
  studentLocked
}: EditEntryFieldsPresenterProps) {
  const { t } = useTranslation('frequentation')
  const futureHelperId = useId()

  return (
    <FieldsWrapper>
      <DateTimeRow>
        <TextField
          type="date"
          size="small"
          label={t('edit.date')}
          value={date}
          error={isFuture}
          onChange={(event) => onDateChange(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: maxDate, 'aria-describedby': isFuture ? futureHelperId : undefined }
          }}
        />
        <TextField
          type="time"
          size="small"
          label={t('edit.time')}
          value={time}
          error={isFuture}
          onChange={(event) => onTimeChange(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-describedby': isFuture ? futureHelperId : undefined }
          }}
        />
      </DateTimeRow>
      {isFuture ? (
        <HelperText id={futureHelperId} variant="caption" role="alert">
          {t('form.futureNotAllowed')}
        </HelperText>
      ) : null}
      <StudentField>
        <StudentLabel aria-hidden>{t('edit.student')}</StudentLabel>
        <Autocomplete
          ariaLabel={t('edit.student')}
          options={studentOptions}
          onSelect={onStudentSelect}
          inputValue={studentInputValue}
          onInputChange={onStudentInputChange}
          clearInputOnSelect={false}
          disabled={studentLocked}
        />
        {studentLocked ? (
          <HelperText variant="caption">{t('edit.anonymizedStudentLocked')}</HelperText>
        ) : null}
      </StudentField>
    </FieldsWrapper>
  )
}
