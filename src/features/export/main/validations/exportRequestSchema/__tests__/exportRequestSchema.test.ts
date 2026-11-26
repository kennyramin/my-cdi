import { describe, it, expect } from 'vitest'
import { exportRequestSchema } from '../exportRequestSchema'

const PERIOD = { startDate: '2026-01-01', endDate: '2026-01-31' }
const PERIOD_KINDS = ['journal', 'visitsByDay', 'visitsByActivity', 'visitsByClass'] as const
const AGGREGATED_KINDS = ['visitsByDay', 'visitsByActivity', 'visitsByClass'] as const

describe('exportRequestSchema', () => {
  it('accepts a journal request with a period', () => {
    const result = exportRequestSchema.safeParse({
      kind: 'journal',
      period: PERIOD,
      includeNames: true
    })
    expect(result.success).toBe(true)
  })

  it.each(PERIOD_KINDS)('rejects a period kind without period (%s)', (kind) => {
    expect(exportRequestSchema.safeParse({ kind, includeNames: false }).success).toBe(false)
  })

  it.each(['2026-13-01', '2026-1-1', ''])('rejects malformed dates (%s)', (startDate) => {
    const result = exportRequestSchema.safeParse({
      kind: 'journal',
      period: { startDate, endDate: '2026-01-31' },
      includeNames: false
    })
    expect(result.success).toBe(false)
  })

  it('rejects start after end', () => {
    const result = exportRequestSchema.safeParse({
      kind: 'journal',
      period: { startDate: '2026-02-01', endDate: '2026-01-31' },
      includeNames: false
    })
    expect(result.success).toBe(false)
  })

  it.each(AGGREGATED_KINDS)(
    'forces includeNames to false for aggregated kinds even when true is sent (%s)',
    (kind) => {
      const result = exportRequestSchema.parse({ kind, period: PERIOD, includeNames: true })
      expect(result.includeNames).toBe(false)
    }
  )

  it('keeps includeNames true for journal', () => {
    const result = exportRequestSchema.parse({
      kind: 'journal',
      period: PERIOD,
      includeNames: true
    })
    expect(result.includeNames).toBe(true)
  })

  it.each([undefined, false])(
    'students request without acknowledgedPersonalData true is rejected (%s)',
    (acknowledgedPersonalData) => {
      const result = exportRequestSchema.safeParse({
        kind: 'students',
        includeNames: true,
        acknowledgedPersonalData
      })
      expect(result.success).toBe(false)
    }
  )

  it('students request ignores period and accepts acknowledgement', () => {
    const result = exportRequestSchema.parse({
      kind: 'students',
      period: PERIOD,
      includeNames: true,
      acknowledgedPersonalData: true
    })
    expect(result.kind).toBe('students')
    expect(result.period).toBeUndefined()
    expect(result.acknowledgedPersonalData).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(
      exportRequestSchema.safeParse({ kind: 'nope', period: PERIOD, includeNames: false }).success
    ).toBe(false)
  })
})
