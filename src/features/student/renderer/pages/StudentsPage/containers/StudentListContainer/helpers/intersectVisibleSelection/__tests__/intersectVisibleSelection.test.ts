import { describe, it, expect } from 'vitest'
import { intersectVisibleSelection } from '../intersectVisibleSelection'

describe('intersectVisibleSelection', () => {
  it('keeps only visible ids, in selection order', () => {
    expect(intersectVisibleSelection([3, 1, 7], [1, 2, 3])).toEqual([3, 1])
  })

  it('returns an empty list when nothing is visible', () => {
    expect(intersectVisibleSelection([5], [])).toEqual([])
  })
})
