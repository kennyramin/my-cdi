import Typography from '@mui/material/Typography'
import { Card } from '@ui/components/Card'
import { styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

// Matches the default Card padding so the bar spans the card's full inner width.
const CARD_PADDING_STEPS = 2.5

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
  color: theme.palette.error.main
}))

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
  marginInline: theme.spacing(-CARD_PADDING_STEPS),
  paddingInline: theme.spacing(CARD_PADDING_STEPS),
  paddingBlock: theme.spacing(CARD_PADDING_STEPS),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`
}))
