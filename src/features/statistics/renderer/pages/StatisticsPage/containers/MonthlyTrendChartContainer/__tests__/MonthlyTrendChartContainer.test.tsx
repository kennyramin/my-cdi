import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MonthlyTrendChartContainer } from '../MonthlyTrendChartContainer'
import '@shared/i18n/config'

const RANGE = { startDate: '2026-04-01', endDate: '2026-04-30' }
const NOV_RANGE = { startDate: '2026-11-01', endDate: '2026-11-11' }
const FIVE = 5
const TEN = 10
const TWO = 2
const FOUR = 4
const ONE = 1
const WIDE = 1200
type ObserverCallback = (entries: { contentRect: { width: number } }[]) => void

let capturedCallback: ObserverCallback | null = null

class FakeResizeObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback
  }
  observe = vi.fn()
  disconnect = vi.fn()
}

function triggerWidth(width: number) {
  act(() => {
    capturedCallback?.([{ contentRect: { width } }])
  })
}

const NOV_COUNTS = [
  { date: '2026-11-01', count: FOUR },
  { date: '2026-11-02', count: TWO }
]

describe('MonthlyTrendChartContainer', () => {
  beforeEach(() => {
    capturedCallback = null
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the chart title', () => {
    render(<MonthlyTrendChartContainer dailyCounts={[]} range={RANGE} />)
    expect(screen.getByText('Évolution sur la période')).toBeInTheDocument()
  })

  it('renders no path elements when there are no daily counts', () => {
    const { container } = render(<MonthlyTrendChartContainer dailyCounts={[]} range={RANGE} />)
    expect(container.querySelectorAll('path').length).toBe(0)
  })

  it('renders the line and area paths plus dots when given counts', () => {
    const { container } = render(
      <MonthlyTrendChartContainer
        range={RANGE}
        dailyCounts={[
          { date: '2026-04-01', count: FIVE },
          { date: '2026-04-02', count: TEN }
        ]}
      />
    )
    expect(container.querySelectorAll('path').length).toBe(TWO)
    expect(container.querySelectorAll('circle').length).toBe(TWO)
  })

  it('draws at the measured pixel width without stretching', () => {
    const { container } = render(
      <MonthlyTrendChartContainer dailyCounts={NOV_COUNTS} range={NOV_RANGE} />
    )
    triggerWidth(WIDE)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1200 200')
    expect(svg?.hasAttribute('preserveAspectRatio')).toBe(false)
  })

  it('labels the first and last day of the period', () => {
    render(<MonthlyTrendChartContainer dailyCounts={NOV_COUNTS} range={NOV_RANGE} />)
    expect(screen.getByText('01/11')).toBeInTheDocument()
    expect(screen.getByText('11/11')).toBeInTheDocument()
  })

  it('gives every dot an accessible tooltip', () => {
    const { container } = render(
      <MonthlyTrendChartContainer dailyCounts={NOV_COUNTS} range={NOV_RANGE} />
    )
    expect(
      [...container.querySelectorAll('circle > title')].map((node) => node.textContent)
    ).toEqual(['01/11 : 4 visites', '02/11 : 2 visites'])
  })

  it('uses the singular tooltip for a single visit', () => {
    const { container } = render(
      <MonthlyTrendChartContainer
        dailyCounts={[{ date: '2026-11-01', count: ONE }]}
        range={NOV_RANGE}
      />
    )
    expect(container.querySelector('circle > title')?.textContent).toBe('01/11 : 1 visite')
  })

  it('renders repeated y values without duplicate-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <MonthlyTrendChartContainer
        dailyCounts={[{ date: '2026-11-01', count: ONE }]}
        range={NOV_RANGE}
      />
    )
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key')
  })

  it('describes the chart through a visually hidden summary', () => {
    render(<MonthlyTrendChartContainer dailyCounts={NOV_COUNTS} range={NOV_RANGE} />)
    const chart = screen.getByRole('img', { name: 'Évolution sur la période' })
    const describedBy = chart.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      'Du 01/11 au 11/11 : 6 visites sur 2 jours avec visites, maximum 4 le 01/11'
    )
  })
})
