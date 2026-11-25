import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { ICON_BUTTON_SIZE_PX } from '@ui/components/IconButton'
import { shouldForwardStyledProp } from '@ui/helpers/shouldForwardStyledProp'

// Cells are border-box with 16px horizontal padding, so fixed column widths
// must include it or the content overflows (and gets clipped by the table).
const CELL_HORIZONTAL_PADDING_PX = 16
const CELL_PADDING_TOTAL_PX = CELL_HORIZONTAL_PADDING_PX * 2
const CELL_SLACK_PX = 4
const SMALL_CHECKBOX_SIZE_PX = 28
const ROW_ACTION_COUNT = 2
const ROW_ACTIONS_GAP_PX = 4

export const CHECKBOX_CELL_WIDTH_PX = SMALL_CHECKBOX_SIZE_PX + CELL_PADDING_TOTAL_PX
export const ACTIONS_CELL_WIDTH_PX =
  ICON_BUTTON_SIZE_PX * ROW_ACTION_COUNT +
  ROW_ACTIONS_GAP_PX * (ROW_ACTION_COUNT - 1) +
  CELL_PADDING_TOTAL_PX +
  CELL_SLACK_PX
export const VISITS_CELL_WIDTH_PX = 100
export const CHECKBOX_CELL_STYLE = { width: CHECKBOX_CELL_WIDTH_PX } as const
export const VISITS_CELL_STYLE = { width: VISITS_CELL_WIDTH_PX } as const
export const ACTIONS_CELL_STYLE = { width: ACTIONS_CELL_WIDTH_PX } as const

export const StudentListLayout = styled(Box, {
  shouldForwardProp: shouldForwardStyledProp
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5)
}))
