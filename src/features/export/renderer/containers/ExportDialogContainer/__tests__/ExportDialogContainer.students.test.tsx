import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { ErrorCode } from '@lib/errors'
import i18n from '@shared/i18n/config'
import { ExportButtonContainer } from '../../ExportButtonContainer'

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

const FR_ACKNOWLEDGE =
  "Je comprends que ce fichier contient des données personnelles et qu'il n'est pas chiffré."

describe('students export dialog', () => {
  const run = vi.fn()

  async function openDialog() {
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="students" />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Exporter la liste' }))
    await screen.findByRole('dialog', { name: 'Exporter la liste des élèves' })
    return user
  }

  beforeEach(async () => {
    await i18n.changeLanguage('fr')
    run.mockReset()
    run.mockResolvedValue({ success: true, data: { path: '/x.csv', rows: 3 } })
    vi.stubGlobal('electronAPI', { export: { run } })
  })

  it('has no kind selector and no names checkbox', async () => {
    await openDialog()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox')).toHaveAccessibleName(FR_ACKNOWLEDGE)
  })

  it('keeps Exporter disabled until the acknowledgement is checked', async () => {
    const user = await openDialog()
    const confirm = screen.getByRole('button', { name: 'Exporter' })
    expect(confirm).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    expect(confirm).toBeEnabled()
  })

  it('does not export without acknowledgement, by click or keyboard, and stays open', async () => {
    const user = await openDialog()
    const confirm = screen.getByRole('button', { name: 'Exporter' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })).not.toBeChecked()
    await user.click(confirm).catch(() => undefined)
    confirm.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(run).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('toggles the acknowledgement with Space', async () => {
    const user = await openDialog()
    const checkbox = screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })
    checkbox.focus()
    await user.keyboard(' ')
    expect(checkbox).toBeChecked()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
  })

  it('disables the button again when the acknowledgement is unchecked', async () => {
    const user = await openDialog()
    const checkbox = screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })
    await user.click(checkbox)
    await user.click(checkbox)
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled()
  })

  it('submit sends kind students with acknowledgedPersonalData true', async () => {
    const user = await openDialog()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({
      kind: 'students',
      includeNames: true,
      acknowledgedPersonalData: true
    })
    expect(await screen.findByText('3 lignes exportées')).toBeInTheDocument()
  })

  it('resets the acknowledgement when the dialog is reopened', async () => {
    const user = await openDialog()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Exporter la liste' }))
    expect(await screen.findByRole('checkbox', { name: FR_ACKNOWLEDGE })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled()
  })

  it('renders the exact fr copy', async () => {
    await openDialog()
    expect(
      screen.getByText(
        "Le fichier contiendra le nom, le prénom, la classe, l'INE et le nombre de visites de chaque élève."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })).toBeInTheDocument()
  })

  it('renders the exact en copy', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    render(<ExportButtonContainer scope="students" />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Export list' }))
    expect(await screen.findByRole('dialog', { name: 'Export the student list' })).toBeVisible()
    expect(
      screen.getByText(
        "The file will contain each student's last name, first name, class, INE and visit count."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: 'I understand this file contains personal data and is not encrypted.'
      })
    ).toBeInTheDocument()
  })

  it('links the description to the checkbox', async () => {
    await openDialog()
    expect(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })).toHaveAccessibleDescription(
      "Le fichier contiendra le nom, le prénom, la classe, l'INE et le nombre de visites de chaque élève."
    )
  })

  it('puts the initial focus on Annuler', async () => {
    await openDialog()
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('locks the dialog while pending and sends one request on a double click', async () => {
    let resolveRun: (value: unknown) => void = () => undefined
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRun = resolve
        })
    )
    const user = await openDialog()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    await user.dblClick(screen.getByRole('button', { name: 'Exporter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled())
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Exporter' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    if (backdrop !== null) {
      await user.click(backdrop)
    }
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => resolveRun({ success: true, data: { cancelled: true } }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('shows an IPC failure as an in-dialog alert without a toast and allows a retry', async () => {
    run.mockResolvedValue({ success: false, error: 'raw', code: ErrorCode.EXPORT_FILE_LOCKED })
    const user = await openDialog()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/\S/)
    expect(alert).not.toHaveTextContent('raw')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
    expect(screen.queryByText('3 lignes exportées')).toBeNull()
  })

  it('returns focus to the trigger when the dialog closes', async () => {
    const user = await openDialog()
    const trigger = screen.getByRole('button', { name: 'Exporter la liste', hidden: true })
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })
})
