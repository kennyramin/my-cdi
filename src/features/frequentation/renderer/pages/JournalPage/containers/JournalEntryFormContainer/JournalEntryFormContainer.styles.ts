import Typography from '@mui/material/Typography'
import type { Theme } from '@mui/material/styles'
import { Card, PADDING_DEFAULT_STEPS } from '@ui/components/Card'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'
import { CONTROL_HEIGHTS } from '@ui/theme'

// The bar spans the card's full inner width, so its side gutters match the default Card padding.
const BAR_GUTTER_STEPS = PADDING_DEFAULT_STEPS
const BAR_PADDING_BLOCK_STEPS = 1.5
const BAR_BORDER_PX = 1
const BAR_HELPER_ALLOWANCE_STEPS = 3

export const SectionLabel = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  color: theme.palette.text.disabled,
  marginBottom: theme.spacing(1.25)
}))

// display: contents lets the sticky SubmitBar use the whole card as its containing block,
// so it stays pinned to the bottom of the scrolling column; the gap is re-created below.
export const EntryForm = styled('form', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'contents',
  '& > * + *': {
    marginTop: theme.spacing(2)
  }
}))

export const FutureDateHelperText = styled(Typography, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'block',
  marginTop: theme.spacing(0.5),
  color: theme.palette.error.main
}))

/**
 * Space the sticky submit bar covers at the bottom of the scrolling form column, including room
 * for the future-date helper line: used as scroll padding so a focused control is never hidden.
 */
export const submitBarClearance = (theme: Theme) =>
  `calc(${theme.spacing(2 * BAR_PADDING_BLOCK_STEPS + BAR_HELPER_ALLOWANCE_STEPS)} + ${CONTROL_HEIGHTS.md + BAR_BORDER_PX}px)`

export const FormCard = styled(Card, {
  shouldForwardProp: shouldForwardStyledProp
})({
  paddingBottom: 0
})

export const SubmitBar = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  marginInline: theme.spacing(-BAR_GUTTER_STEPS),
  paddingInline: theme.spacing(BAR_GUTTER_STEPS),
  paddingBlock: theme.spacing(BAR_PADDING_BLOCK_STEPS),
  backgroundColor: theme.palette.background.paper,
  borderTop: `${BAR_BORDER_PX}px solid ${theme.palette.divider}`
}))
