import { useTranslation } from 'react-i18next'
import Checkbox from '@mui/material/Checkbox'
import {
  AcknowledgeField,
  DescriptionText,
  STUDENTS_DESCRIPTION_ID
} from './ExportStudentsFieldsPresenter.styles'

interface ExportStudentsFieldsPresenterProps {
  acknowledged: boolean
  onAcknowledgeChange: (event: unknown, checked: boolean) => void
  isPending: boolean
}

export function ExportStudentsFieldsPresenter({
  acknowledged,
  onAcknowledgeChange,
  isPending
}: ExportStudentsFieldsPresenterProps) {
  const { t } = useTranslation('export')

  return (
    <>
      <DescriptionText variant="body1" id={STUDENTS_DESCRIPTION_ID}>
        {t('students.description')}
      </DescriptionText>
      <AcknowledgeField
        control={
          <Checkbox
            checked={acknowledged}
            onChange={onAcknowledgeChange}
            disabled={isPending}
            slotProps={{ input: { 'aria-describedby': STUDENTS_DESCRIPTION_ID } }}
          />
        }
        label={t('students.acknowledge')}
      />
    </>
  )
}
