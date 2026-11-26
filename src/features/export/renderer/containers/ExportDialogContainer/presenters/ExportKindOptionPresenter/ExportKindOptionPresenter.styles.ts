import FormControlLabel from '@mui/material/FormControlLabel'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const KindOptionLabel = styled(FormControlLabel, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  '& .MuiFormControlLabel-label': {
    fontSize: theme.typography.body1.fontSize
  }
}))
