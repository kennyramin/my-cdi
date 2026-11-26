import { useTheme } from '@mui/material/styles'
import { avatarColor } from './helpers/avatarColor'
import type { AvatarProps } from './types/AvatarProps'
import { AvatarRoot } from './Avatar.styles'

export function Avatar({
  initials,
  colorSeed,
  neutral = false,
  size = 'md',
  className
}: AvatarProps) {
  const theme = useTheme()
  const isNeutral = neutral || colorSeed === null
  const bg = isNeutral
    ? theme.palette.action.disabledBackground
    : avatarColor(colorSeed, theme.palette).bg
  return (
    <AvatarRoot
      className={className}
      aria-hidden={isNeutral ? true : undefined}
      $bg={bg}
      $neutral={isNeutral}
      $size={size}
    >
      {initials}
    </AvatarRoot>
  )
}
