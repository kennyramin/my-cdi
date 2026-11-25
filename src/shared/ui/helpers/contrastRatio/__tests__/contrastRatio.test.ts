import { describe, it, expect } from 'vitest'
import { contrastRatio } from '../contrastRatio'

const MAX_RATIO = 21
const AUDITED_DEFECT_RATIO = 4.34
const RATIO_PRECISION = 2

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(MAX_RATIO, RATIO_PRECISION)
  })

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
  })

  it('reproduces the audited dim text defect', () => {
    expect(contrastRatio('#64748b', '#f1f5f9')).toBeCloseTo(AUDITED_DEFECT_RATIO, RATIO_PRECISION)
  })

  it('does not depend on the argument order', () => {
    expect(contrastRatio('#64748b', '#f1f5f9')).toBe(contrastRatio('#f1f5f9', '#64748b'))
  })
})
