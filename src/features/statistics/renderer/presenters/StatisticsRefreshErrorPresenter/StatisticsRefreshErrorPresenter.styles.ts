import Alert from '@mui/material/Alert'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const StatisticsRefreshErrorAlert = styled(Alert, {
  shouldForwardProp: shouldForwardStyledProp
})({})
