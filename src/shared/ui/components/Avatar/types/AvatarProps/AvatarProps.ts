export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  initials: string
  colorSeed: number | null
  neutral?: boolean
  size?: AvatarSize
  className?: string
}
