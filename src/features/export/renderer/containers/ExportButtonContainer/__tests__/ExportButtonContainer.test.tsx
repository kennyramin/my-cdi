import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import i18n from '@shared/i18n/config'
import { ExportButtonContainer } from '../ExportButtonContainer'

const PERIOD = { startDate: '2026-09-01', endDate: '2026-11-30' }
const EXPLANATION_ID = 'range-explanation'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}

describe('ExportButtonContainer', () => {
  const run = vi.fn()

  beforeEach(async () => {
    await i18n.changeLanguage('fr')
    run.mockReset()
    run.mockResolvedValue({ success: true, data: { path: '/x.csv', rows: 1 } })
    vi.stubGlobal('electronAPI', { export: { run } })
  })

  it('renders the Exporter button and no dialog until clicked', () => {
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the English label', async () => {
    await i18n.changeLanguage('en')
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('opens the dialog with the current period', async () => {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    expect(await screen.findByRole('dialog', { name: 'Exporter les statistiques' })).toBeVisible()
    expect(screen.getByText('Période : du 01/09/2026 au 30/11/2026')).toBeInTheDocument()
  })

  it('is disabled and described by the explanation when disabled', () => {
    render(
      <>
        <p id={EXPLANATION_ID}>La date de fin doit être postérieure</p>
        <ExportButtonContainer
          scope="statistics"
          period={PERIOD}
          disabled
          disabledDescriptionId={EXPLANATION_ID}
        />
      </>,
      { wrapper }
    )
    const button = screen.getByRole('button', { name: 'Exporter' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('La date de fin doit être postérieure')
  })

  it('does not describe an enabled button', () => {
    render(
      <ExportButtonContainer
        scope="statistics"
        period={PERIOD}
        disabled={false}
        disabledDescriptionId={EXPLANATION_ID}
      />,
      { wrapper }
    )
    expect(screen.getByRole('button', { name: 'Exporter' })).not.toHaveAttribute('aria-describedby')
  })

  it('exports, shows the success toast and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    const trigger = screen.getByRole('button', { name: 'Exporter' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Exporter' }))
    expect(await screen.findByText('1 ligne exportée')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    const trigger = screen.getByRole('button', { name: 'Exporter' })
    await user.click(trigger)
    await user.click(await screen.findByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
    expect(run).not.toHaveBeenCalled()
  })

  it('starts each opening from a fresh state', async () => {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    await user.click(await screen.findByRole('radio', { name: 'Visites par jour' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    expect(await screen.findByRole('radio', { name: 'Journal des visites' })).toBeChecked()
  })

  it('keeps the dialog content while it closes (no empty flash)', async () => {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="statistics" period={PERIOD} disabled={false} />, {
      wrapper
    })
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    await user.click(await screen.findByRole('radio', { name: 'Visites par classe' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('radio', { name: 'Visites par classe', hidden: true })).toBeChecked()
  })
})
