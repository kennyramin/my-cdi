import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const SectionLabel = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.disabled,
  marginBottom: theme.spacing(1.25)
}))

export const EntryForm = styled('form', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2)
}))

export const FutureDateHelperText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.error.main
}))

export const SubmitBar = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  backgroundColor: theme.palette.background.paper,
  paddingBlock: theme.spacing(1)
}))
