import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import type { ReactNode } from 'react'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import { StudentListContainer } from '../StudentListContainer'
import type { StudentResponseDto } from '@student-shared'

const STUDENT_ID_FIRST = 1
const LEA_ID = 2

const MOCK_DTOS: StudentResponseDto[] = [
  {
    id: STUDENT_ID_FIRST,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: '111A',
    fullName: 'Jean Dupont',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0
  },
  {
    id: LEA_ID,
    nom: 'Martin',
    prenom: 'Léa',
    classe: '3ème B',
    ine: '222B',
    fullName: 'Léa Martin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0
  }
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    )
  }
}

describe('StudentListContainer', () => {
  const deleteMock = vi.fn()
  const anonymizeMock = vi.fn()

  beforeEach(() => {
    deleteMock.mockReset()
    anonymizeMock.mockReset()
    anonymizeMock.mockResolvedValue({
      success: true,
      data: { anonymized: 0, deletedWithoutVisits: 1, ignored: 0 }
    })
    deleteMock.mockResolvedValue({ success: true })
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: MOCK_DTOS } }),
        delete: deleteMock,
        anonymize: anonymizeMock
      }
    })
  })

  it('renders the toolbar with the add button', async () => {
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(screen.getByText('Ajouter un élève')).toBeInTheDocument()
    })
  })

  it('toggles aria-sort when the Nom header button is clicked', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const nomHeader = await screen.findByRole('columnheader', { name: /Nom/ })
    const visitsHeader = screen.getByRole('columnheader', { name: /Visites/ })
    expect(nomHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(visitsHeader).toHaveAttribute('aria-sort', 'none')

    await user.click(screen.getByRole('button', { name: 'Nom' }))
    expect(nomHeader).toHaveAttribute('aria-sort', 'descending')

    await user.click(screen.getByRole('button', { name: 'Visites' }))
    expect(visitsHeader).toHaveAttribute('aria-sort', 'descending')
    expect(nomHeader).toHaveAttribute('aria-sort', 'none')
  })

  it('shows the trimmed search term in the empty state', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    await user.type(await screen.findByLabelText('Rechercher par nom, prénom, classe…'), 'zzz ')

    expect(
      screen.getByText('Aucun élève ne correspond à « zzz »', { normalizer: (text) => text })
    ).toBeInTheDocument()
  })

  it('shows the search term verbatim in the empty state', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    await user.type(await screen.findByLabelText('Rechercher par nom, prénom, classe…'), "l'é")

    expect(screen.getByText("Aucun élève ne correspond à « l'é »")).toBeInTheDocument()
  })

  it('batch delete sends only visible selected ids', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    await user.click(await screen.findByRole('checkbox', { name: 'Sélectionner Léa Martin' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner Jean Dupont' }))
    await user.type(screen.getByPlaceholderText(/Rechercher/), 'Martin')

    expect(screen.getByText('1 élève sélectionné')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Supprimer la sélection' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(1)
    })
    expect(deleteMock).toHaveBeenCalledWith({ id: LEA_ID })
  })

  it('select all selects only visible students', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const search = await screen.findByPlaceholderText(/Rechercher/)
    await user.type(search, 'Dupont')
    await user.click(screen.getByRole('button', { name: 'Tout sélectionner' }))
    await user.clear(search)

    expect(screen.getByRole('checkbox', { name: 'Sélectionner Jean Dupont' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Léa Martin' })).not.toBeChecked()
  })

  it('row delete confirmation warns about history', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const row = await screen.findByRole('row', { name: /Léa/ })
    await user.click(within(row).getByRole('button', { name: 'Supprimer' }))

    expect(
      await screen.findByText(
        'Supprimer cet élève supprimera aussi tout son historique de fréquentation. Cette action est irréversible.'
      )
    ).toBeInTheDocument()
  })

  it('clicking Retirer opens the anonymize dialog, not the delete dialog', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const row = await screen.findByRole('row', { name: /Léa/ })
    await user.click(within(row).getByRole('button', { name: "Retirer l'élève Léa Martin" }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Retirer 1 élève ?')).toBeInTheDocument()
    expect(
      within(dialog).getByText('1 élève sans visite sera simplement supprimé.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Confirmer la suppression')).toBeNull()
  })

  it('row anonymize shows the toast with counts', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const row = await screen.findByRole('row', { name: /Léa/ })
    await user.click(within(row).getByRole('button', { name: "Retirer l'élève Léa Martin" }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Retirer' }))

    await waitFor(() => {
      expect(anonymizeMock).toHaveBeenCalledWith({ ids: [LEA_ID] })
    })
    expect(
      await screen.findByText('Retrait terminé : 0 anonymisé(s), 1 supprimé(s) sans visite.')
    ).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('batch anonymize sends only visible selected ids, shows the toast and clears the selection', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    await user.click(await screen.findByRole('checkbox', { name: 'Sélectionner Léa Martin' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner Jean Dupont' }))
    await user.type(screen.getByPlaceholderText(/Rechercher/), 'Martin')

    await user.click(screen.getByRole('button', { name: 'Retirer la sélection' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Retirer' }))

    await waitFor(() => {
      expect(anonymizeMock).toHaveBeenCalledTimes(1)
    })
    expect(anonymizeMock).toHaveBeenCalledWith({ ids: [LEA_ID] })
    expect(
      await screen.findByText('Retrait terminé : 0 anonymisé(s), 1 supprimé(s) sans visite.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/élève sélectionné/)).toBeNull()
  })

  it('Supprimer keeps its existing confirmation text', async () => {
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const row = await screen.findByRole('row', { name: /Léa/ })
    await user.click(within(row).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Confirmer la suppression')).toBeInTheDocument()
    expect(anonymizeMock).not.toHaveBeenCalled()
  })

  it('row dialog cannot be closed or relaunched while anonymizing', async () => {
    anonymizeMock.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<StudentListContainer onEditStudent={vi.fn()} onAddStudent={vi.fn()} />, {
      wrapper: createWrapper()
    })

    const row = await screen.findByRole('row', { name: /Léa/ })
    await user.click(within(row).getByRole('button', { name: "Retirer l'élève Léa Martin" }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Retirer' }))
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Retirer' })).toBeDisabled()
    })

    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(anonymizeMock).toHaveBeenCalledTimes(1)
  })
})
