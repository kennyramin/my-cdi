import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const FieldsWrapper = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2)
}))

export const DateTimeRow = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  '& > *': {
    flex: '1 1 140px'
  }
}))

export const StudentField = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5)
}))

export const StudentLabel = styled('label', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.palette.text.secondary
}))

export const HelperText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.secondary
}))
