import { describe, it, expect } from 'vitest'
import { normalizeIne } from '../normalizeIne'

describe('normalizeIne', () => {
  it('trims and upper-cases', () => {
    expect(normalizeIne('  ab12 ')).toBe('AB12')
  })
})
