import { describe, it, expect } from 'vitest'
import { EXPORT_KINDS, isCancelledExport, isPeriodExportKind } from '../types'

describe('isCancelledExport', () => {
  it('is true for a cancelled result', () => {
    expect(isCancelledExport({ cancelled: true })).toBe(true)
  })

  it('is false for a written result', () => {
    expect(isCancelledExport({ path: '/tmp/a.csv', rows: 3 })).toBe(false)
  })
})

describe('isPeriodExportKind', () => {
  it.each(['journal', 'visitsByDay', 'visitsByActivity', 'visitsByClass'] as const)(
    '%s uses a period',
    (kind) => {
      expect(isPeriodExportKind(kind)).toBe(true)
    }
  )

  it('the students list is the only kind without a period', () => {
    expect(EXPORT_KINDS.filter((kind) => !isPeriodExportKind(kind))).toEqual(['students'])
  })
})
