import { describe, it, expect } from 'vitest'
import {
  buildRemovalConfirmation,
  isRemovalConfirmed,
  requiresRemovalConfirmation
} from '../removalConfirmation'

const TOTAL_HUNDRED = 100
const TWELVE = 12
const ELEVEN = 11
const TEN = 10
const NINE = 9

describe('requiresRemovalConfirmation', () => {
  it('requires confirmation at exactly 10', () => {
    expect(requiresRemovalConfirmation(TEN, TOTAL_HUNDRED)).toBe(true)
  })

  it('not at 9 of 100', () => {
    expect(requiresRemovalConfirmation(NINE, TOTAL_HUNDRED)).toBe(false)
  })

  it('not at exactly 50% (2 of 4)', () => {
    expect(requiresRemovalConfirmation(2, 4)).toBe(false)
  })

  it('at more than 50% (3 of 5)', () => {
    expect(requiresRemovalConfirmation(3, 5)).toBe(true)
  })

  it('1 of 1 requires confirmation', () => {
    expect(requiresRemovalConfirmation(1, 1)).toBe(true)
  })

  it('never when toRemove is 0', () => {
    expect(requiresRemovalConfirmation(0, 0)).toBe(false)
    expect(requiresRemovalConfirmation(0, TOTAL_HUNDRED)).toBe(false)
  })
})

describe('removal confirmation text', () => {
  it('builds the expected sentence', () => {
    expect(buildRemovalConfirmation(TWELVE)).toBe('RETIRER 12')
  })

  it('isRemovalConfirmed accepts " retirer 12 "', () => {
    expect(isRemovalConfirmed(' retirer 12 ', TWELVE)).toBe(true)
  })

  it('rejects RETIRER 11 for 12', () => {
    expect(isRemovalConfirmed(`RETIRER ${ELEVEN}`, TWELVE)).toBe(false)
  })

  it('rejects undefined/empty', () => {
    expect(isRemovalConfirmed(undefined, TWELVE)).toBe(false)
    expect(isRemovalConfirmed('', TWELVE)).toBe(false)
  })
})
