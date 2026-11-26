import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import { StatisticsRefreshErrorPresenter } from '../StatisticsRefreshErrorPresenter'
import '@shared/i18n/config'

describe('StatisticsRefreshErrorPresenter', () => {
  it('renders the interpolated non-blocking message with status role', () => {
    render(
      <ThemeProvider theme={theme}>
        <StatisticsRefreshErrorPresenter message="boom" />
      </ThemeProvider>
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      "Les données affichées n'ont pas pu être actualisées : boom"
    )
  })
})
