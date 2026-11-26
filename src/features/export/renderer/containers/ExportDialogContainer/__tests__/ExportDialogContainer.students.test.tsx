import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
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
    expect(screen.queryByRole('checkbox', { name: /noms/ })).toBeNull()
  })

  it('keeps Exporter disabled until the acknowledgement is checked', async () => {
    const user = await openDialog()
    const confirm = screen.getByRole('button', { name: 'Exporter' })
    expect(confirm).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE }))
    expect(confirm).toBeEnabled()
  })

  it('toggles the acknowledgement with Space and ignores Enter on the disabled button', async () => {
    const user = await openDialog()
    const checkbox = screen.getByRole('checkbox', { name: FR_ACKNOWLEDGE })
    const confirm = screen.getByRole('button', { name: 'Exporter' })
    expect(confirm).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(run).not.toHaveBeenCalled()
    checkbox.focus()
    await user.keyboard(' ')
    expect(checkbox).toBeChecked()
    expect(confirm).toBeEnabled()
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
})
