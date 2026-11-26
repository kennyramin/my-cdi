import Radio from '@mui/material/Radio'
import { KindOptionLabel } from './ExportKindOptionPresenter.styles'

interface ExportKindOptionPresenterProps {
  value: string
  label: string
}

export function ExportKindOptionPresenter({ value, label }: ExportKindOptionPresenterProps) {
  return <KindOptionLabel value={value} control={<Radio />} label={label} />
}
