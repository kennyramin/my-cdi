export const REMOVAL_CONFIRM_MIN_COUNT = 10
export const REMOVAL_CONFIRM_MAJORITY_RATIO = 0.5
export const REMOVAL_CONFIRM_KEYWORD = 'RETIRER'

export function requiresRemovalConfirmation(toRemove: number, total: number): boolean {
  return (
    toRemove > 0 &&
    (toRemove >= REMOVAL_CONFIRM_MIN_COUNT || toRemove > total * REMOVAL_CONFIRM_MAJORITY_RATIO)
  )
}

export function buildRemovalConfirmation(toRemove: number): string {
  return `${REMOVAL_CONFIRM_KEYWORD} ${toRemove}`
}

export function isRemovalConfirmed(input: string | undefined, toRemove: number): boolean {
  if (input === undefined) {
    return false
  }
  return input.trim().toUpperCase() === buildRemovalConfirmation(toRemove)
}
