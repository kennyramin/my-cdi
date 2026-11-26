import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import '@shared/i18n/config'
import { theme } from '@ui/theme'
import { StudentCsvImportButtonPresenter } from '../StudentCsvImportButtonPresenter'
import type { CsvRemovalPreview } from '@student-shared'

type PresenterProps = Parameters<typeof StudentCsvImportButtonPresenter>[0]

const NONE = 0
const TWELVE = 12
const MAX_SAMPLE = 20
const OVER_SAMPLE_TOTAL = 25
const TOTAL = 100

function buildNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Prénom${index} Nom${index}`)
}

function renderPresenter(overrides: Partial<PresenterProps> = {}) {
  const props: PresenterProps = {
    isModalOpen: true,
    pendingFile: new File(['x'], 'eleves.csv'),
    result: null,
    errorLines: [],
    error: null,
    isPending: false,
    inputRef: { current: null },
    toast: null,
    canDownloadReport: false,
    updateExisting: false,
    removeAbsent: false,
    removalPreview: null,
    handleRetryPreview: vi.fn(),
    isPreviewPending: false,
    previewError: null,
    confirmationText: '',
    confirmationPhrase: 'RETIRER 0',
    needsConfirmation: false,
    canSubmit: true,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    handleFileChange: vi.fn(),
    handleDropzoneClick: vi.fn(),
    handleDropzoneKeyDown: vi.fn(),
    handleSubmit: vi.fn(),
    handleToggleUpdateExisting: vi.fn(),
    handleToggleRemoveAbsent: vi.fn(),
    handleConfirmationChange: vi.fn(),
    handleDownloadReport: vi.fn(),
    dismissToast: vi.fn(),
    ...overrides
  }
  render(
    <ThemeProvider theme={theme}>
      <StudentCsvImportButtonPresenter {...props} />
    </ThemeProvider>
  )
  return props
}

function withPreview(preview: CsvRemovalPreview, overrides: Partial<PresenterProps> = {}) {
  return renderPresenter({
    removeAbsent: true,
    updateExisting: true,
    removalPreview: preview,
    ...overrides
  })
}

describe('StudentCsvImportButtonPresenter removal option', () => {
  it('shows the unchecked removal checkbox and no backup note until checked', () => {
    renderPresenter()
    expect(screen.getByLabelText('Retirer les élèves absents du fichier')).not.toBeChecked()
    expect(screen.queryByText(/copie de sécurité/)).not.toBeInTheDocument()
  })

  it('calls the toggle handler when the checkbox is clicked', async () => {
    const props = renderPresenter()
    await userEvent.click(screen.getByLabelText('Retirer les élèves absents du fichier'))
    expect(props.handleToggleRemoveAbsent).toHaveBeenCalledOnce()
  })

  it('locks the update existing checkbox while removal is on', () => {
    withPreview({ toRemove: NONE, total: TOTAL, sample: [] })
    const checkbox = screen.getByLabelText('Mettre à jour les élèves existants')
    expect(checkbox).toBeChecked()
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/Les élèves retirés sont anonymisés/)).toBeInTheDocument()
    expect(screen.getByText(/copie de sécurité/)).toBeInTheDocument()
  })

  it('shows count, total and the names', () => {
    withPreview({ toRemove: 2, total: 5, sample: ['Anne Martin', 'Jean Dupont'] })
    expect(screen.getByText('2 élèves sur 5 seront retirés :')).toBeInTheDocument()
    expect(screen.getByText('Anne Martin')).toBeInTheDocument()
    expect(screen.queryByText(/… et \d+ autres/)).not.toBeInTheDocument()
  })

  it('uses the singular for one student', () => {
    withPreview({ toRemove: 1, total: 5, sample: ['Anne Martin'] })
    expect(screen.getByText('1 élève sur 5 sera retiré :')).toBeInTheDocument()
  })

  it('shows at most 20 names and the remaining count', () => {
    withPreview({ toRemove: OVER_SAMPLE_TOTAL, total: TOTAL, sample: buildNames(MAX_SAMPLE + 3) })
    expect(screen.getAllByText(/^Prénom\d+ Nom\d+$/)).toHaveLength(MAX_SAMPLE)
    expect(screen.getByText('… et 5 autres')).toBeInTheDocument()
  })

  it('says there is nobody to remove', () => {
    withPreview({ toRemove: NONE, total: 5, sample: [] })
    expect(screen.getByText('Aucun élève à retirer.')).toBeInTheDocument()
  })

  it('explains a rowErrors block and never shows the raw code', () => {
    withPreview(
      { toRemove: NONE, total: 5, sample: [], blockedReason: 'rowErrors' },
      { canSubmit: false }
    )
    expect(screen.getByText(/lignes en erreur/)).toBeInTheDocument()
    expect(screen.queryByText('rowErrors')).not.toBeInTheDocument()
    expect(screen.queryByText(/Aucun élève à retirer/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer et retirer' })).toBeDisabled()
  })

  it('explains an emptyFile block', () => {
    withPreview(
      { toRemove: NONE, total: 5, sample: [], blockedReason: 'emptyFile' },
      { canSubmit: false }
    )
    expect(screen.getByText(/aucun élève valide/)).toBeInTheDocument()
    expect(screen.queryByText('emptyFile')).not.toBeInTheDocument()
  })

  it('shows the preview error', () => {
    renderPresenter({ removeAbsent: true, updateExisting: true, previewError: 'boom' })
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('shows the typed confirmation field with the exact phrase above the threshold', async () => {
    const props = withPreview(
      { toRemove: TWELVE, total: TOTAL, sample: buildNames(3) },
      { needsConfirmation: true, confirmationPhrase: 'RETIRER 12', canSubmit: false }
    )
    expect(screen.getByLabelText('Pour confirmer, tapez RETIRER 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer et retirer' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), 'r')
    expect(props.handleConfirmationChange).toHaveBeenCalledWith('r')
  })

  it('has no confirmation field below the threshold', () => {
    withPreview({ toRemove: 2, total: TOTAL, sample: buildNames(2) })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer et retirer' })).toBeEnabled()
  })

  it('keeps the plain submit label when the option is off', () => {
    renderPresenter()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()
  })

  it('shows the removal counts in the result warning', () => {
    withPreview(
      { toRemove: 1, total: 5, sample: ['Anne Martin'] },
      {
        result: {
          created: 0,
          updated: 1,
          errors: 1,
          errorDetails: [],
          anonymized: 2,
          deletedWithoutVisits: 3
        }
      }
    )
    expect(screen.getByText(/2 anonymisé\(s\), 3 supprimé\(s\) sans visite/)).toBeInTheDocument()
  })

  it('shows a loading message while the preview is pending', () => {
    renderPresenter({ removeAbsent: true, updateExisting: true, isPreviewPending: true })
    expect(screen.getByText('Analyse du fichier…')).toBeInTheDocument()
  })

  it('offers a retry after a preview failure', async () => {
    const props = renderPresenter({ removeAbsent: true, updateExisting: true, previewError: 'x' })
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(props.handleRetryPreview).toHaveBeenCalledOnce()
  })

  it('announces the preview politely and focuses the confirmation field', () => {
    withPreview(
      { toRemove: TWELVE, total: TOTAL, sample: buildNames(3) },
      { needsConfirmation: true, confirmationPhrase: 'RETIRER 12', canSubmit: false }
    )
    expect(
      screen.getByText('12 élèves sur 100 seront retirés :').closest('[aria-live]')
    ).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByLabelText('Pour confirmer, tapez RETIRER 12')).toHaveFocus()
  })
})
