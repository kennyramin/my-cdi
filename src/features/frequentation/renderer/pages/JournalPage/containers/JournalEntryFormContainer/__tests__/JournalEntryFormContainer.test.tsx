import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { formatLocalDate } from '@lib/localDateTime'
import { JournalEntryFormContainer } from '../JournalEntryFormContainer'

const FIRST_ID = 1

function withProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
            {ui}
          </LocalizationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('JournalEntryFormContainer', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: {
            students: [
              {
                id: FIRST_ID,
                nom: 'Dupont',
                prenom: 'Jean',
                classe: '3A',
                ine: 'INE-1',
                createdAt: '',
                updatedAt: ''
              }
            ]
          }
        })
      },
      frequentation: {
        createBatch: vi.fn().mockResolvedValue({ success: true, data: { created: FIRST_ID } })
      }
    })
  })

  it('renders the autocomplete combobox and the activity grid in the in-place card', () => {
    render(withProviders(<JournalEntryFormContainer selectedDate="2026-04-01" />))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('disables the submit button when no students are selected', () => {
    render(withProviders(<JournalEntryFormContainer selectedDate="2026-04-01" />))
    const submitButton = screen.getByRole('button', { name: /enregistrer/i })
    expect(submitButton).toBeDisabled()
  })

  it('focuses the student search when the user types with nothing focused', () => {
    render(withProviders(<JournalEntryFormContainer selectedDate="2026-04-01" />))
    const searchInput = screen.getByRole('combobox')
    expect(document.activeElement).toBe(document.body)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))

    expect(document.activeElement).toBe(searchInput)
  })

  it('does not hijack typing inside an editable target', () => {
    render(withProviders(<JournalEntryFormContainer selectedDate="2026-04-01" />))
    const searchInput = screen.getByRole('combobox')
    searchInput.focus()

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    )

    expect(document.activeElement).toBe(searchInput)
  })

  it('explains and disables submit for a future date', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    render(withProviders(<JournalEntryFormContainer selectedDate={formatLocalDate(tomorrow)} />))
    const helper = screen.getByText("Impossible d'enregistrer une présence dans le futur")
    const submitButton = screen.getByRole('button', { name: /enregistrer/i })
    expect(submitButton).toBeDisabled()
    expect(helper).toHaveAttribute('role', 'status')
    expect(submitButton).toHaveAttribute('aria-describedby', helper.id)
  })

  it('renders the future-date explanation inside the sticky submit bar, next to the button', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    render(withProviders(<JournalEntryFormContainer selectedDate={formatLocalDate(tomorrow)} />))
    const helper = screen.getByText("Impossible d'enregistrer une présence dans le futur")
    const submitBar = screen.getByRole('button', { name: /enregistrer/i }).parentElement
    expect(submitBar).toContainElement(helper)
  })

  it('shows no future warning for today', () => {
    render(withProviders(<JournalEntryFormContainer selectedDate={formatLocalDate(new Date())} />))
    expect(screen.queryByText(/dans le futur/)).toBeNull()
  })

  describe('duplicate warning', () => {
    async function submitWithDuplicates(selectedDate: string, loseFocusOnSubmit = false) {
      window.electronAPI.frequentation.createBatch = vi.fn().mockImplementation(async () => {
        if (loseFocusOnSubmit && document.activeElement instanceof HTMLElement) {
          // Chromium drops focus when the clicked button becomes disabled while the request runs.
          document.activeElement.blur()
        }
        return {
          success: true,
          data: {
            created: 0,
            duplicates: [
              {
                studentId: FIRST_ID,
                studentName: 'Jean Dupont',
                existingStartsAt: `${selectedDate}T10:15:00`,
                existingActivity: 'WORK'
              }
            ]
          }
        }
      })
      const user = userEvent.setup()
      render(withProviders(<JournalEntryFormContainer selectedDate={selectedDate} />))
      await user.type(screen.getByRole('combobox'), 'Dup')
      await user.click(await screen.findByRole('option', { name: /Dupont/ }))
      const submit = screen.getByRole('button', { name: 'Enregistrer' })
      await waitFor(() => {
        expect(submit).toBeEnabled()
      })
      await user.click(submit)
      return { user, submit }
    }

    it('shows the dialog, and cancelling returns focus to the sticky submit button', async () => {
      const { user, submit } = await submitWithDuplicates('2026-04-01')
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('Jean Dupont')
      await user.click(screen.getByRole('button', { name: 'Annuler' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      await waitFor(() => {
        expect(document.activeElement).toBe(submit)
      })
      expect(submit).toBeEnabled()
      expect(window.electronAPI.frequentation.createBatch).toHaveBeenCalledOnce()
    })

    it('keeps the submit button enabled while the dialog is open', async () => {
      const { submit } = await submitWithDuplicates('2026-04-01')
      await screen.findByRole('dialog')
      expect(submit).toBeEnabled()
    })

    it('resends once with allowDuplicates when confirmed, then clears the form', async () => {
      const { user } = await submitWithDuplicates('2026-04-01')
      const createBatch = vi.mocked(window.electronAPI.frequentation.createBatch)
      createBatch.mockResolvedValueOnce({ success: true, data: { created: 1, errors: [] } })
      await screen.findByRole('dialog')
      await user.click(screen.getByRole('button', { name: 'Enregistrer quand même' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      await waitFor(() => {
        expect(createBatch).toHaveBeenCalledTimes(2)
      })
      expect(createBatch.mock.calls[0]?.[0]).not.toHaveProperty('allowDuplicates')
      expect(createBatch.mock.calls[1]?.[0]).toMatchObject({ allowDuplicates: true })
      expect(await screen.findByText('Fréquentation(s) enregistrée(s)')).toBeInTheDocument()
    })

    it('refocuses the submit button on cancel even when focus was lost while sending', async () => {
      const { user, submit } = await submitWithDuplicates('2026-04-01', true)
      await screen.findByRole('dialog')
      await user.click(screen.getByRole('button', { name: 'Annuler' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      await waitFor(() => {
        expect(document.activeElement).toBe(submit)
      })
    })

    it('refocuses the submit button when the dialog is dismissed with Escape', async () => {
      const { user, submit } = await submitWithDuplicates('2026-04-01', true)
      await screen.findByRole('dialog')
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      await waitFor(() => {
        expect(document.activeElement).toBe(submit)
      })
    })
  })
})
