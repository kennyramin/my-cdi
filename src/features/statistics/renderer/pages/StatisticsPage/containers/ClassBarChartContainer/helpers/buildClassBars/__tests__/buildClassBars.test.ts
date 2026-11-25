import { describe, it, expect } from 'vitest'
import { buildClassBars, MIN_BAR_PERCENT } from '../buildClassBars'

const TOP_COUNT = 6
const TIED_COUNT = 3
const CLASS_TOTAL = 12
const KEPT = 10
const FULL_WIDTH = 100
const HALF_WIDTH = 50
const HUGE_COUNT = 1000

describe('buildClassBars', () => {
  it('sorts by count desc, then by class name (fr, numeric)', () => {
    expect(
      buildClassBars([
        { classe: '5B', count: TIED_COUNT },
        { classe: '6A', count: TOP_COUNT },
        { classe: '4C', count: TIED_COUNT }
      ])
    ).toEqual([
      { classe: '6A', count: TOP_COUNT, widthPercent: FULL_WIDTH },
      { classe: '4C', count: TIED_COUNT, widthPercent: HALF_WIDTH },
      { classe: '5B', count: TIED_COUNT, widthPercent: HALF_WIDTH }
    ])
  })

  it('keeps the top 10 classes', () => {
    const twelveClasses = Array.from({ length: CLASS_TOTAL }, (_, index) => ({
      classe: String(index + 1),
      count: CLASS_TOTAL - index
    }))
    expect(buildClassBars(twelveClasses).map((bar) => bar.classe)).toEqual(
      Array.from({ length: KEPT }, (_, index) => String(index + 1))
    )
  })

  it('keeps a visible minimum width for tiny non-zero shares', () => {
    const bars = buildClassBars([
      { classe: '6A', count: HUGE_COUNT },
      { classe: '5B', count: 1 }
    ])
    expect(bars.map((bar) => bar.widthPercent)).toEqual([FULL_WIDTH, MIN_BAR_PERCENT])
  })

  it('returns no bars for no data', () => {
    expect(buildClassBars([])).toEqual([])
  })

  it('does not mutate the input', () => {
    const input = [
      { classe: 'B', count: 1 },
      { classe: 'A', count: 2 }
    ]
    buildClassBars(input)
    expect(input.map((entry) => entry.classe)).toEqual(['B', 'A'])
  })
})
