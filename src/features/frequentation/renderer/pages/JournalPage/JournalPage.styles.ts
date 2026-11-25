import { styled } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

const GRID_FIRST_COLUMN_PX = 320

export const PageGrid = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `${GRID_FIRST_COLUMN_PX}px minmax(0, 1fr)`,
  gridTemplateRows: '1fr',
  gap: theme.spacing(3),
  height: '100%',
  minHeight: 0
}))

const columnStyles = (theme: Theme) =>
  ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    minHeight: 0
  }) as const

export const FormColumn = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  ...columnStyles(theme),
  overflowY: 'auto'
}))

export const ListColumn = styled('div', {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  ...columnStyles(theme),
  minWidth: 0
}))
