import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { StudentBatchActionsContainer } from '../StudentBatchActionsContainer'

const STUDENT_ID_FIRST = 1
const STUDENT_ID_SECOND = 2
const STUDENT_ID_THIRD = 3
const SELECTED_COUNT = 2
const ZERO_SELECTED = 0
const TOTAL_COUNT = 10
const THREE_SELECTED = 3
const SELECTED_IDS_PAIR = [STUDENT_ID_FIRST, STUDENT_ID_SECOND]
const SELECTED_IDS_TRIPLE = [STUDENT_ID_FIRST, STUDENT_ID_SECOND, STUDENT_ID_THIRD]

function renderWithClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{node}</ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('StudentBatchActionsContainer', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
      }
    })
  })

  it('renders select all and delete buttons', () => {
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={SELECTED_IDS_PAIR}
        selectedCount={SELECTED_COUNT}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={vi.fn()}
      />
    )

    expect(screen.getByText('Tout sélectionner')).toBeInTheDocument()
    expect(screen.getByText('Supprimer la sélection')).toBeInTheDocument()
    expect(screen.getByText('2 élèves sélectionnés')).toBeInTheDocument()
  })

  it('uses the singular selected label for one student', () => {
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={[STUDENT_ID_FIRST]}
        selectedCount={1}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={vi.fn()}
      />
    )

    expect(screen.getByText('1 élève sélectionné')).toBeInTheDocument()
  })

  it('disables delete button when nothing selected', () => {
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={[]}
        selectedCount={ZERO_SELECTED}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={vi.fn()}
      />
    )

    const deleteButton = screen.getByText('Supprimer la sélection')
    expect(deleteButton).toBeDisabled()
  })

  it('shows confirmation dialog when delete is clicked', () => {
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={SELECTED_IDS_TRIPLE}
        selectedCount={THREE_SELECTED}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={vi.fn()}
      />
    )

    const deleteButton = screen.getByText('Supprimer la sélection')
    fireEvent.click(deleteButton)

    expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument()
  })

  it('disables Retirer la sélection without selection', () => {
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={[]}
        selectedCount={ZERO_SELECTED}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Retirer la sélection' })).toBeDisabled()
  })

  it('sends only the selected ids in ONE IPC call and reports the result', async () => {
    const result = { anonymized: 2, deletedWithoutVisits: 0, ignored: 0 }
    const anonymize = vi.fn().mockResolvedValue({ success: true, data: result })
    vi.stubGlobal('electronAPI', { student: { anonymize, delete: vi.fn() } })
    const onAfterAnonymize = vi.fn()
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={SELECTED_IDS_PAIR}
        selectedCount={SELECTED_COUNT}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={onAfterAnonymize}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retirer la sélection' }))
    expect(screen.getByText('Retirer 2 élèves ?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))

    await waitFor(() => expect(onAfterAnonymize).toHaveBeenCalledWith(result))
    expect(anonymize).toHaveBeenCalledTimes(1)
    expect(anonymize).toHaveBeenCalledWith({ ids: SELECTED_IDS_PAIR })
  })

  it('keeps the dialog open and shows the translated error when the backup fails', async () => {
    const anonymize = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'boom', code: 'BACKUP_WRITE_FAILED' })
    vi.stubGlobal('electronAPI', { student: { anonymize, delete: vi.fn() } })
    const onAfterAnonymize = vi.fn()
    renderWithClient(
      <StudentBatchActionsContainer
        selectedIds={SELECTED_IDS_PAIR}
        selectedCount={SELECTED_COUNT}
        totalCount={TOTAL_COUNT}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onAfterDelete={vi.fn()}
        withoutVisitsCount={0}
        onAfterAnonymize={onAfterAnonymize}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retirer la sélection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'écriture de la sauvegarde a échoué"
    )
    expect(screen.getByText('Retirer 2 élèves ?')).toBeInTheDocument()
    expect(onAfterAnonymize).not.toHaveBeenCalled()
  })
})
