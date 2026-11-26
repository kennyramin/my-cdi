import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const DescriptionText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2)
}))

export const AcknowledgeField = styled(FormControlLabel, {
  shouldForwardProp: shouldForwardStyledProp
})({
  display: 'flex'
})
