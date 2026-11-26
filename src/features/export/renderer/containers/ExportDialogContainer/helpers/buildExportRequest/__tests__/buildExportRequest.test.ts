import { describe, it, expect } from 'vitest'
import { buildExportRequest } from '../buildExportRequest'

const PERIOD = { startDate: '2026-09-01', endDate: '2026-11-30' }
const STATISTICS = { scope: 'statistics', period: PERIOD } as const

describe('buildExportRequest', () => {
  it('keeps includeNames for the journal', () => {
    expect(buildExportRequest(STATISTICS, 'journal', true)).toEqual({
      kind: 'journal',
      period: PERIOD,
      includeNames: true
    })
  })

  it.each(['visitsByDay', 'visitsByActivity', 'visitsByClass'] as const)(
    'forces includeNames to false for %s',
    (kind) => {
      expect(buildExportRequest(STATISTICS, kind, true)).toEqual({
        kind,
        period: PERIOD,
        includeNames: false
      })
    }
  )

  it('builds a period-less students request', () => {
    expect(buildExportRequest({ scope: 'students' }, 'journal', true)).toEqual({
      kind: 'students',
      includeNames: false
    })
  })
})
