import FormControl from '@mui/material/FormControl'
import type { ElementType } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Typography from '@mui/material/Typography'
import { alpha, styled } from '@mui/material/styles'
import { TINT_ALPHAS } from '@ui/theme'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

const HINT_INDENT_STEPS = 4.25

export const KIND_LEGEND_ID = 'export-kind-legend'
export const NAMES_HINT_ID = 'export-names-hint'

export const KindFieldset = styled(FormControl, {
  shouldForwardProp: shouldForwardStyledProp
})<{ component?: ElementType }>(({ theme }) => ({
  display: 'flex',
  marginBottom: theme.spacing(2)
}))

export const KindLegend = styled(FormLabel, {
  shouldForwardProp: shouldForwardStyledProp
})<{ component?: ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightMedium
}))

export const PeriodText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2)
}))

export const NamesField = styled(FormControlLabel, {
  shouldForwardProp: shouldForwardStyledProp
})({
  display: 'flex'
})

export const NamesHint = styled(FormHelperText, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  marginInline: theme.spacing(HINT_INDENT_STEPS),
  marginTop: 0
}))

export const NamesWarning = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  backgroundColor: alpha(theme.palette.warning.main, TINT_ALPHAS.surface),
  border: `1px solid ${alpha(theme.palette.warning.main, TINT_ALPHAS.border)}`
}))
