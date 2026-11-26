import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import { StatisticsErrorPresenter } from '../StatisticsErrorPresenter'
import '@shared/i18n/config'

function renderPresenter(isRetrying: boolean, onRetry = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <StatisticsErrorPresenter message="boom" onRetry={onRetry} isRetrying={isRetrying} />
    </ThemeProvider>
  )
  return onRetry
}

describe('StatisticsErrorPresenter', () => {
  it('renders the message and an alert role', () => {
    renderPresenter(false)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les statistiques')
    expect(alert).toHaveTextContent('boom')
  })

  it('calls onRetry when clicking Réessayer', () => {
    const onRetry = renderPresenter(false)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables the button while retrying', () => {
    renderPresenter(true)
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeDisabled()
  })
})
