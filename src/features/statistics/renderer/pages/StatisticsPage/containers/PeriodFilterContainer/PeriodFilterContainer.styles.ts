import Typography from '@mui/material/Typography'
import { alpha, styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'
import { Icon } from '@ui/components/Icon'
import { FONT_WEIGHTS, RADII, TINT_ALPHAS } from '@ui/theme'

export const BTN_HEIGHT_PX = 32

export const CUSTOM_START_INPUT_ID = 'statistics-custom-start'
export const CUSTOM_END_INPUT_ID = 'statistics-custom-end'
export const CUSTOM_RANGE_MESSAGE_ID = 'statistics-custom-range-message'

export const PeriodFilterWrapper = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1)
}))

export const CustomRangeRow = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  alignItems: 'center'
}))

export const CustomRangeField = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}))

export const CustomRangeLabel = styled('label', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary
}))

export const CustomRangeInput = styled('input', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  height: `${BTN_HEIGHT_PX}px`,
  paddingInline: theme.spacing(1.25),
  borderRadius: RADII.small,
  border: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  fontFamily: 'inherit',
  fontSize: theme.typography.body2.fontSize,
  colorScheme: theme.palette.mode,
  '&[aria-invalid="true"]': {
    borderColor: theme.palette.error.main
  }
}))

export const CustomRangeError = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: theme.typography.body2.fontSize
}))

export const PeriodFilterRow = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'wrap'
}))

export const PeriodFilterButton = styled('button', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  height: `${BTN_HEIGHT_PX}px`,
  paddingInline: theme.spacing(1.75),
  borderRadius: RADII.small,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: FONT_WEIGHTS.medium,
  border: '1px solid',
  borderColor: theme.palette.divider,
  transition: theme.transitions.create(['background-color', 'border-color', 'color']),
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: theme.palette.text.disabled,
  '&[data-active="true"]': {
    fontWeight: FONT_WEIGHTS.semibold,
    borderColor: alpha(theme.palette.primary.main, TINT_ALPHAS.border),
    backgroundColor: alpha(theme.palette.primary.main, TINT_ALPHAS.surface),
    color: theme.palette.primary.main
  },
  '&:hover': {
    borderColor: theme.palette.dividerStrong,
    color: theme.palette.text.primary
  },
  '&[data-active="true"]:hover': {
    borderColor: alpha(theme.palette.primary.main, TINT_ALPHAS.border),
    color: theme.palette.primary.main
  }
}))

export const PeriodFilterIcon = styled(Icon, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  fontSize: theme.typography.subtitle2.fontSize
}))
