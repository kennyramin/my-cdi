import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

export const DataLayout = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2)
}))

export const StatusLine = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.primary,
  '&[data-warning="true"]': {
    color: theme.palette.warning.main
  },
  '&[data-loading="true"]': {
    color: theme.palette.text.secondary
  }
}))

export const ActionRow = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5)
}))

export const PrivacyNote = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary
}))

export const WarningHint = styled('span', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  marginInlineStart: theme.spacing(1),
  fontWeight: theme.typography.fontWeightMedium,
  '&::before': { content: '"— "' }
}))
