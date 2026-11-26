import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { ErrorCode } from '@lib/errors'
import i18n from '@shared/i18n/config'
import { ExportDialogContainer } from '../ExportDialogContainer'

const PERIOD = { startDate: '2026-09-01', endDate: '2026-11-30' }

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

describe('ExportDialogContainer', () => {
  const run = vi.fn()
  const onClose = vi.fn()
  const onResult = vi.fn()
  let resolveRun: (value: unknown) => void

  function renderDialog() {
    return render(
      <ExportDialogContainer
        open
        scope="statistics"
        period={PERIOD}
        onClose={onClose}
        onResult={onResult}
      />,
      { wrapper }
    )
  }

  beforeEach(async () => {
    await i18n.changeLanguage('fr')
    run.mockReset()
    onClose.mockReset()
    onResult.mockReset()
    run.mockResolvedValue({ success: true, data: { path: '/x.csv', rows: 4 } })
    vi.stubGlobal('electronAPI', { export: { run } })
  })

  it('names the dialog from its title', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Exporter les statistiques' })).toBeInTheDocument()
  })

  it('labels the radiogroup by its legend with journal selected by default', () => {
    renderDialog()
    const group = screen.getByRole('radiogroup', { name: 'Données à exporter' })
    expect(within(group).getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: 'Journal des visites' })).toBeChecked()
    expect(screen.getByText('Données à exporter').tagName).toBe('LEGEND')
  })

  it('gives the names checkbox an accessible name and describes it by the hint', () => {
    renderDialog()
    const checkbox = screen.getByRole('checkbox', { name: 'Inclure les noms des élèves' })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAccessibleDescription(
      'Disponible uniquement pour le journal. Les autres exports ne contiennent jamais de noms.'
    )
  })

  it('shows the names warning as a note only when names are checked', async () => {
    const user = userEvent.setup()
    renderDialog()
    expect(screen.queryByRole('note')).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: 'Inclure les noms des élèves' }))
    expect(screen.getByRole('note')).toHaveTextContent(
      "Le fichier contiendra des données personnelles d'élèves. Conservez-le en lieu sûr."
    )
    await user.click(screen.getByRole('radio', { name: 'Visites par jour' }))
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Inclure les noms des élèves' })).toBeDisabled()
  })

  it('renders exact fr copy', () => {
    renderDialog()
    expect(screen.getByText('Période : du 01/09/2026 au 30/11/2026')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Visites par activité' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Visites par classe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument()
  })

  it('renders exact en copy', async () => {
    await i18n.changeLanguage('en')
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Export statistics' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Data to export' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Visit journal' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Visits per day' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Visits per activity' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Visits per class' })).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Include student names' })
    ).toHaveAccessibleDescription(
      'Only available for the journal. Other exports never contain names.'
    )
    expect(screen.getByText('Period: 01/09/2026 to 30/11/2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('puts the initial focus on the safe action "Annuler"', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('exports and reports the row count', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('4 lignes exportées', 'success'))
    expect(run).toHaveBeenCalledWith({ kind: 'journal', period: PERIOD, includeNames: false })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends one request on a double click and locks the dialog while pending', async () => {
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRun = resolve
        })
    )
    const user = userEvent.setup()
    renderDialog()
    await user.dblClick(screen.getByRole('button', { name: 'Exporter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled())
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Exporter' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => resolveRun({ success: true, data: { cancelled: true } }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onResult).not.toHaveBeenCalled()
  })

  it('shows the failure inside the dialog as an alert and in the toast', async () => {
    run.mockResolvedValue({ success: false, error: 'raw', code: ErrorCode.EXPORT_FILE_LOCKED })
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/\S/)
    expect(alert).not.toHaveTextContent('raw')
    expect(onResult).toHaveBeenCalledWith(alert.textContent, 'error')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
  })

  it('closes from Annuler', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(run).not.toHaveBeenCalled()
  })
})
