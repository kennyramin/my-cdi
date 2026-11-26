import { describe, it, expect } from 'vitest'
import { intersectSelectedIds } from '../intersectSelectedIds'

describe('intersectSelectedIds', () => {
  it('keeps selected ids that are visible, in selected order', () => {
    expect(intersectSelectedIds([3, 1, 2], [1, 2])).toEqual([1, 2])
  })

  it('returns an empty array when no selected id is visible', () => {
    expect(intersectSelectedIds([3], [1, 2])).toEqual([])
  })

  it('returns an empty array when nothing is selected', () => {
    expect(intersectSelectedIds([], [1])).toEqual([])
  })
})
