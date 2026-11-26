import type { RefObject } from 'react'

export interface AutocompleteOption<T> {
  value: T
  label: string
  badge?: string
}

export interface AutocompleteProps<T> {
  placeholder?: string
  options: AutocompleteOption<T>[]
  onSelect: (option: AutocompleteOption<T>) => void
  inputValue?: string
  onInputChange?: (next: string) => void
  excludedValues?: T[]
  maxResults?: number
  disableCloseOnSelect?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  disabled?: boolean
  ariaLabel?: string
  /** When false the typed/selected text is left to the caller (single-value fields). */
  clearInputOnSelect?: boolean
}
