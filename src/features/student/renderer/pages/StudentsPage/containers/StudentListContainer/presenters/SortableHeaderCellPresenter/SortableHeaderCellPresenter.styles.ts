import { styled } from '@mui/material/styles'
import { TYPE_SCALE } from '@ui/theme'

export const SORT_ICON_FONT_SIZE_PX = TYPE_SCALE.body1
export const FOCUS_OUTLINE_WIDTH_PX = 2

export const SortHeaderButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  textTransform: 'inherit',
  letterSpacing: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
  '&:hover': {
    color: theme.palette.text.secondary
  },
  '&:focus-visible': {
    outline: `${FOCUS_OUTLINE_WIDTH_PX}px solid ${theme.palette.primary.main}`,
    outlineOffset: theme.spacing(0.25)
  }
}))

export const SortIcon = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  fontSize: SORT_ICON_FONT_SIZE_PX,
  marginLeft: theme.spacing(0.25),
  '& .material-icons-round': {
    fontSize: 'inherit'
  },
  '&[data-active="false"]': {
    opacity: theme.palette.action.disabledOpacity
  }
}))
