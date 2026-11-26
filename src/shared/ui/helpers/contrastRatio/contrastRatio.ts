const HEX_RADIX = 16
const HEX_PREFIX_LENGTH = 1
const HEX_CHANNEL_LENGTH = 2
const RED_OFFSET = 0
const GREEN_OFFSET = HEX_CHANNEL_LENGTH
const BLUE_OFFSET = HEX_CHANNEL_LENGTH * 2
const MAX_CHANNEL_VALUE = 255

const LINEARIZATION_THRESHOLD = 0.03928
const LINEAR_DIVISOR = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_DIVISOR = 1.055
const GAMMA_EXPONENT = 2.4

const RED_WEIGHT = 0.2126
const GREEN_WEIGHT = 0.7152
const BLUE_WEIGHT = 0.0722

const LUMINANCE_FLARE = 0.05

function readChannel(hex: string, offset: number): number {
  const start = HEX_PREFIX_LENGTH + offset
  return parseInt(hex.slice(start, start + HEX_CHANNEL_LENGTH), HEX_RADIX) / MAX_CHANNEL_VALUE
}

function linearize(channel: number): number {
  if (channel <= LINEARIZATION_THRESHOLD) {
    return channel / LINEAR_DIVISOR
  }
  return ((channel + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT
}

function relativeLuminance(hex: string): number {
  return (
    RED_WEIGHT * linearize(readChannel(hex, RED_OFFSET)) +
    GREEN_WEIGHT * linearize(readChannel(hex, GREEN_OFFSET)) +
    BLUE_WEIGHT * linearize(readChannel(hex, BLUE_OFFSET))
  )
}

/** WCAG 2.x contrast ratio (1 to 21) between two `#rrggbb` colors. */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + LUMINANCE_FLARE) / (darker + LUMINANCE_FLARE)
}
