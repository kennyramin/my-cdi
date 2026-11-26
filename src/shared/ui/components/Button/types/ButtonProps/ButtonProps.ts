import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}
