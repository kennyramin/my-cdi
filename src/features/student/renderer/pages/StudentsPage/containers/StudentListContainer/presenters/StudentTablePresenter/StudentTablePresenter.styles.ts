import Box from '@mui/material/Box'
import { alpha, styled } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'
import { FONT_WEIGHTS, TINT_ALPHAS } from '@ui/theme'

// Nom, Prénom, Classe and INE columns: keep them on one line and ellipsize.
const FIRST_TRUNCATED_COLUMN = 2
const LAST_TRUNCATED_COLUMN = 5

export const TableRoot = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  boxShadow: theme.shadows[1],
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed'
  },
  '& th': {
    textAlign: 'left',
    padding: theme.spacing(1.5, 2),
    fontSize: theme.typography.overline.fontSize,
    fontWeight: FONT_WEIGHTS.semibold,
    color: theme.palette.text.disabled,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.overline.letterSpacing,
    backgroundColor: theme.palette.surface,
    borderBottom: `1px solid ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
    userSelect: 'none'
  },
  '& td': {
    padding: theme.spacing(1.5, 2),
    fontSize: theme.typography.body1.fontSize,
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: 'middle'
  },
  [`& td:nth-of-type(n+${FIRST_TRUNCATED_COLUMN}):nth-of-type(-n+${LAST_TRUNCATED_COLUMN})`]: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  '& tr:last-child td': {
    borderBottom: 'none'
  },
  '& tbody tr': {
    transition: theme.transitions.create('background-color')
  },
  '& tbody tr:hover': {
    backgroundColor: theme.palette.surface,
    color: theme.palette.text.secondary
  },
  '& tbody tr[data-selected="true"]': {
    backgroundColor: alpha(theme.palette.primary.main, TINT_ALPHAS.surface)
  },
  '& tbody tr[data-selected="true"]:hover': {
    backgroundColor: alpha(theme.palette.primary.main, TINT_ALPHAS.surface)
  }
}))

export const TableScroll = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})({
  overflowX: 'auto'
})

export const TableElement = styled('table', {
  shouldForwardProp: shouldForwardStyledProp
})({
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed'
})

export const EmptyCell = styled('td', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  textAlign: 'center',
  color: theme.palette.text.secondary,
  paddingBlock: theme.spacing(4)
}))

export const TableFooter = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.disabled
}))
