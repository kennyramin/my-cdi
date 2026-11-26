import { describe, it, expect } from 'vitest'
import { isCancelledExport } from '../types'

describe('isCancelledExport', () => {
  it('is true for a cancelled result', () => {
    expect(isCancelledExport({ cancelled: true })).toBe(true)
  })

  it('is false for a written result', () => {
    expect(isCancelledExport({ path: '/tmp/a.csv', rows: 3 })).toBe(false)
  })
})
