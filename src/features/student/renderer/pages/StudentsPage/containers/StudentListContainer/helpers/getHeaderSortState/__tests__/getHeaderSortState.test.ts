import { describe, it, expect } from 'vitest'
import { getHeaderSortState } from '../getHeaderSortState'

describe('getHeaderSortState', () => {
  it('returns ascending state for the active field sorted asc', () => {
    expect(getHeaderSortState({ field: 'nom', direction: 'asc' }, 'nom')).toEqual({
      ariaSort: 'ascending',
      iconName: 'arrow_upward',
      isActive: true
    })
  })

  it('returns descending state for the active field sorted desc', () => {
    expect(getHeaderSortState({ field: 'nom', direction: 'desc' }, 'nom')).toEqual({
      ariaSort: 'descending',
      iconName: 'arrow_downward',
      isActive: true
    })
  })

  it('returns the neutral state for a non-active field', () => {
    expect(getHeaderSortState({ field: 'nom', direction: 'asc' }, 'classe')).toEqual({
      ariaSort: 'none',
      iconName: 'unfold_more',
      isActive: false
    })
  })
})
