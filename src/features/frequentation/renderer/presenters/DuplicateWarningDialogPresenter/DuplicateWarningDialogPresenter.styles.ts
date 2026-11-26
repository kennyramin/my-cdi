import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const IntroText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1)
}))

export const DuplicateList = styled('ul', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  color: theme.palette.text.primary,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5)
}))
