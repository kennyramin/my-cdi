import { describe, it, expect } from 'vitest'
import { buildTrendPath } from '../buildTrendPath'

const WIDTH = 400
const HEIGHT = 200
const PADDING_TOP = 10
const PADDING_RIGHT = 10
const PADDING_BOTTOM = 30
const PADDING_LEFT = 40
const BASE_Y = 170
const MID_Y = 90
const X_SECOND_DOT = 75
const X_LAST_DOT = 390
const X_DST_DOT = 250
const X_SINGLE_DOT = 215

const DIMENSIONS = {
  width: WIDTH,
  height: HEIGHT,
  paddingTop: PADDING_TOP,
  paddingRight: PADDING_RIGHT,
  paddingBottom: PADDING_BOTTOM,
  paddingLeft: PADDING_LEFT
}
const RANGE = { startDate: '2026-11-01', endDate: '2026-11-11' }
const COUNTS = [
  { date: '2026-11-11', count: 4 },
  { date: '2026-11-01', count: 4 },
  { date: '2026-11-02', count: 2 }
]
const trend = buildTrendPath(COUNTS, RANGE, DIMENSIONS)

describe('buildTrendPath', () => {
  it('returns an empty path when there are no daily counts', () => {
    const empty = buildTrendPath([], RANGE, DIMENSIONS)
    expect(empty.path).toBe('')
    expect(empty.dots).toHaveLength(0)
    expect(empty.yLabels).toHaveLength(0)
    expect(empty.xLabels).toHaveLength(0)
  })

  it('returns the viewBox of the given dimensions even with no data', () => {
    expect(buildTrendPath([], RANGE, DIMENSIONS).viewBox).toBe('0 0 400 200')
  })

  it('places dots proportionally to their date so gaps stay visible', () => {
    expect(trend.dots.map((dot) => dot.cx)).toEqual([PADDING_LEFT, X_SECOND_DOT, X_LAST_DOT])
  })

  it('starts the y scale at zero', () => {
    expect(trend.yLabels).toEqual([
      { id: 'min', value: 0, y: BASE_Y },
      { id: 'mid', value: 2, y: MID_Y },
      { id: 'max', value: 4, y: PADDING_TOP }
    ])
  })

  it('builds line and area paths on the time scale', () => {
    expect(trend.path).toBe('M40,10 L75,90 L390,10')
    expect(trend.areaPath).toBe('M40,10 L75,90 L390,10 L390,170 L40,170 Z')
  })

  it('labels the first and last day of the period', () => {
    expect(trend.xLabels).toEqual([
      { id: 'start', x: PADDING_LEFT, label: '01/11', anchor: 'start' },
      { id: 'end', x: X_LAST_DOT, label: '11/11', anchor: 'end' }
    ])
  })

  it('exposes date, day label and count on each dot', () => {
    expect(trend.dots[1]).toEqual({
      cx: X_SECOND_DOT,
      cy: MID_Y,
      date: '2026-11-02',
      dayLabel: '02/11',
      count: 2
    })
  })

  it('keeps whole-day offsets across the DST change', () => {
    const dst = buildTrendPath(
      [{ date: '2026-10-26', count: 1 }],
      { startDate: '2026-10-20', endDate: '2026-10-30' },
      DIMENSIONS
    )
    expect(dst.dots[0]?.cx).toBe(X_DST_DOT)
  })

  it('centres the dot of a single-day range', () => {
    const single = buildTrendPath(
      [{ date: '2026-11-05', count: 3 }],
      { startDate: '2026-11-05', endDate: '2026-11-05' },
      DIMENSIONS
    )
    expect(single.dots[0]?.cx).toBe(X_SINGLE_DOT)
    expect(single.path).not.toMatch(/NaN|Infinity/)
  })

  it('gives distinct ids when label values repeat', () => {
    const one = buildTrendPath([{ date: '2026-11-01', count: 1 }], RANGE, DIMENSIONS)
    expect(one.yLabels.map((label) => label.value)).toEqual([0, 1, 1])
    expect(one.yLabels.map((label) => label.id)).toEqual(['min', 'mid', 'max'])
  })

  it('starts the line path with M and closes the area with Z', () => {
    expect(trend.path.startsWith('M')).toBe(true)
    expect(trend.areaPath.endsWith('Z')).toBe(true)
  })
})
