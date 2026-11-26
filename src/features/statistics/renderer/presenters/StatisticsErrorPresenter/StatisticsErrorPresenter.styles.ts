import Alert from '@mui/material/Alert'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const StatisticsErrorAlert = styled(Alert, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  alignItems: 'center',
  '& .MuiAlert-message': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5)
  }
}))
