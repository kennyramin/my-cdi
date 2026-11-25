import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: MOCK_DTOS } }),
        delete: vi.fn().mockResolvedValue({ success: true })
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
    expect(visitsHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(nomHeader).toHaveAttribute('aria-sort', 'none')
  })
})
