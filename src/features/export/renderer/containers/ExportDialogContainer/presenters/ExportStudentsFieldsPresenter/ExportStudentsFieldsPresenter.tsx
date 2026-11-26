import { useTranslation } from 'react-i18next'
import Checkbox from '@mui/material/Checkbox'
import { AcknowledgeField, DescriptionText } from './ExportStudentsFieldsPresenter.styles'

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
      <DescriptionText variant="body1">{t('students.description')}</DescriptionText>
      <AcknowledgeField
        control={
          <Checkbox checked={acknowledged} onChange={onAcknowledgeChange} disabled={isPending} />
        }
        label={t('students.acknowledge')}
      />
    </>
  )
}
