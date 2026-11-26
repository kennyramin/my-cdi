import type { IconProps } from './types/IconProps'

export function Icon({ name, className, style }: IconProps) {
  const finalClassName = className ? `material-icons-round ${className}` : 'material-icons-round'
  return (
    <span className={finalClassName} style={style} aria-hidden="true">
      {name}
    </span>
  )
}
