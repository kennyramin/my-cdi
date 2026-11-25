import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import { ClassBarChartContainer } from '../ClassBarChartContainer'
import '@shared/i18n/config'

const SIX = 6
const THREE = 3

function renderChart(classCounts: { classe: string; count: number }[]) {
  render(
    <ThemeProvider theme={theme}>
      <ClassBarChartContainer classCounts={classCounts} />
    </ThemeProvider>
  )
}

describe('ClassBarChartContainer', () => {
  it('renders the card title even without data', () => {
    renderChart([])
    expect(screen.getByText('Fréquentation par classe')).toBeInTheDocument()
  })

  it('lists classes with their counts in order', () => {
    renderChart([
      { classe: '5B', count: THREE },
      { classe: '6A', count: SIX }
    ])
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['6A6', '5B3'])
  })

  it('shows the empty state without data', () => {
    renderChart([])
    expect(screen.getByText('Aucune visite sur cette période')).toBeInTheDocument()
  })
})
