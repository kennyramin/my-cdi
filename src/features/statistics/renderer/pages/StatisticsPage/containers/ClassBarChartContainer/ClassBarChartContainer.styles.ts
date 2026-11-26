import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'
import { FONT_WEIGHTS, MONO_FONT_FAMILY, RADII } from '@ui/theme'

const LABEL_MIN_WIDTH_PX = 56
const VALUE_MIN_WIDTH_PX = 32
const TRACK_HEIGHT_PX = 10

export const ClassBarList = styled('ol', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5)
}))

export const ClassBarRow = styled('li', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5)
}))

export const ClassLabel = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  minWidth: `${LABEL_MIN_WIDTH_PX}px`,
  color: theme.palette.text.primary
}))

export const ClassTrack = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  flex: 1,
  height: `${TRACK_HEIGHT_PX}px`,
  borderRadius: `${RADII.small}px`,
  background: theme.palette.action.hover,
  overflow: 'hidden'
}))

export const ClassFill = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})<{ $widthPercent: number }>(({ theme, $widthPercent }) => ({
  height: '100%',
  width: `${$widthPercent}%`,
  borderRadius: `${RADII.small}px`,
  background: theme.palette.primary.main,
  transition: theme.transitions.create('width', { easing: 'ease-out' })
}))

export const ClassValue = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  minWidth: `${VALUE_MIN_WIDTH_PX}px`,
  textAlign: 'right',
  fontFamily: MONO_FONT_FAMILY,
  fontWeight: FONT_WEIGHTS.semibold,
  color: theme.palette.text.primary
}))
