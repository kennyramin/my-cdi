import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { ThemeProvider } from '@mui/material/styles'
import type { ReactNode } from 'react'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import dayjs from 'dayjs'
import { ActivityType } from '@types'
import { JournalPage } from '../JournalPage'

function withQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <I18nextProvider i18n={i18n}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
            {ui}
          </LocalizationProvider>
        </I18nextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('JournalPage', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } })
      },
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        createBatch: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    })
  })

  it('renders the calendar, in-place form, and the attendance list shell', async () => {
    render(withQuery(<JournalPage />))
    // CalendarContainer renders weekday headers once the month query resolves
    await waitFor(() => {
      expect(screen.getByText('Lun')).toBeInTheDocument()
    })
    // Attendance list header (Présents) rendered
    await waitFor(() => {
      expect(screen.getByText('Présents')).toBeInTheDocument()
    })
  })

  it('opens the edit dialog for an anonymized entry showing label and class', async () => {
    const user = userEvent.setup()
    const day = dayjs().format('YYYY-MM-DD')
    const startsAt = `${day}T10:00:00`
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } })
      },
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              frequentation: {
                id: 9,
                startsAt,
                activity: ActivityType.WORK,
                studentId: null,
                studentName: '',
                studentClass: '5C',
                studentIne: '',
                createdAt: startsAt,
                updatedAt: startsAt
              },
              student: null
            }
          ]
        }),
        createBatch: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    })
    render(withQuery(<JournalPage />))
    await user.click(await screen.findByText('Élève anonymisé'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Élève anonymisé')).toBeInTheDocument()
    expect(within(dialog).getByText('5C')).toBeInTheDocument()
    expect(within(dialog).getByText('?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
    expect(within(dialog).getByRole('combobox', { name: 'Élève' })).toBeDisabled()
    expect(
      within(dialog).getByText('Un élève anonymisé ne peut pas être réassocié à une personne.')
    ).toBeInTheDocument()
  })

  describe('editing date and time', () => {
    const ENTRY_ID = 11
    const STUDENT_ID = 4
    const day = dayjs().format('YYYY-MM-DD')
    const startsAt = `${day}T00:10:00`

    // Pin "now" to noon so the early-morning times below are never in the future.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${day}T12:00:00`))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function entryRow(at: string) {
      return {
        frequentation: {
          id: ENTRY_ID,
          startsAt: at,
          activity: ActivityType.WORK,
          studentId: STUDENT_ID,
          studentName: 'Alice Martin',
          studentClass: '6A',
          studentIne: 'I1',
          createdAt: at,
          updatedAt: at
        },
        student: {
          id: STUDENT_ID,
          nom: 'Martin',
          prenom: 'Alice',
          classe: '6A',
          ine: 'I1',
          createdAt: at,
          updatedAt: at
        }
      }
    }

    const duplicates = [
      {
        studentId: STUDENT_ID,
        studentName: 'Alice Martin',
        existingStartsAt: `${day}T00:20:00`,
        existingActivity: ActivityType.WORK
      }
    ]

    function stub(update: ReturnType<typeof vi.fn>) {
      const getJournalEntries = vi
        .fn()
        .mockResolvedValue({ success: true, data: [entryRow(startsAt)] })
      vi.stubGlobal('electronAPI', {
        student: { list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } }) },
        frequentation: { getJournalEntries, createBatch: vi.fn(), update, delete: vi.fn() }
      })
      return getJournalEntries
    }

    it('closes the dialog and re-queries after moving the entry to another day', async () => {
      const user = userEvent.setup()
      const update = vi.fn().mockResolvedValue({ success: true, data: { id: ENTRY_ID } })
      const getJournalEntries = stub(update)
      render(withQuery(<JournalPage />))
      await user.click(await screen.findByText('Alice Martin'))
      const dialog = await screen.findByRole('dialog')
      const callsBefore = getJournalEntries.mock.calls.length
      fireEvent.change(within(dialog).getByLabelText('Date'), {
        target: { value: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }
      })
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(update.mock.calls[0]?.[0]).toMatchObject({
        id: ENTRY_ID,
        startsAt: expect.any(String)
      })
      await waitFor(() => expect(getJournalEntries.mock.calls.length).toBeGreaterThan(callsBefore))
    })

    it('shows both dialogs on duplicates, Escape closes the warning and focus returns', async () => {
      const user = userEvent.setup()
      const update = vi.fn().mockResolvedValue({ success: true, data: { created: 0, duplicates } })
      stub(update)
      render(withQuery(<JournalPage />))
      await user.click(await screen.findByText('Alice Martin'))
      const editDialog = await screen.findByRole('dialog', { name: "Modifier l'entrée" })
      fireEvent.change(within(editDialog).getByLabelText('Heure'), { target: { value: '00:15' } })
      await user.click(within(editDialog).getByRole('button', { name: 'Enregistrer' }))
      const warning = await screen.findByRole('dialog', { name: 'Présence déjà enregistrée' })
      expect(warning).toBeInTheDocument()
      expect(editDialog).toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Présence déjà enregistrée' })
        ).not.toBeInTheDocument()
      )
      expect(screen.getByRole('dialog', { name: "Modifier l'entrée" })).toBeInTheDocument()
      expect(
        within(screen.getByRole('dialog', { name: "Modifier l'entrée" })).getByLabelText('Heure')
      ).toHaveValue('00:15')
      expect(
        screen.getByRole('dialog', { name: "Modifier l'entrée" }).contains(document.activeElement)
      ).toBe(true)
    })

    it('disables saving and explains why for a future time', async () => {
      const user = userEvent.setup()
      stub(vi.fn())
      render(withQuery(<JournalPage />))
      await user.click(await screen.findByText('Alice Martin'))
      const dialog = await screen.findByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText('Date'), {
        target: { value: dayjs().add(1, 'day').format('YYYY-MM-DD') }
      })
      expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
      expect(within(dialog).getByText(/dans le futur/)).toBeInTheDocument()
    })

    it('shows the server error in the dialog and keeps it open', async () => {
      const user = userEvent.setup()
      const update = vi.fn().mockResolvedValue({ success: false, error: 'STUDENT_NOT_FOUND' })
      stub(update)
      render(withQuery(<JournalPage />))
      await user.click(await screen.findByText('Alice Martin'))
      const dialog = await screen.findByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText('Heure'), { target: { value: '00:05' } })
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
      expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('saves an anonymized entry with only its id and activity, without any student identity', async () => {
    const user = userEvent.setup()
    const ENTRY_ID = 9
    const day = dayjs().format('YYYY-MM-DD')
    const startsAt = `${day}T10:00:00`
    const update = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: ENTRY_ID,
        startsAt,
        activity: ActivityType.WORK,
        studentId: null,
        studentName: 'Élève anonymisé',
        studentClass: '5C',
        studentIne: '',
        createdAt: startsAt,
        updatedAt: startsAt
      }
    })
    vi.stubGlobal('electronAPI', {
      student: {
        list: vi.fn().mockResolvedValue({ success: true, data: { students: [] } })
      },
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              frequentation: {
                id: ENTRY_ID,
                startsAt,
                activity: ActivityType.WORK,
                studentId: null,
                studentName: 'Élève anonymisé',
                studentClass: '5C',
                studentIne: '',
                createdAt: startsAt,
                updatedAt: startsAt
              },
              student: null
            }
          ]
        }),
        createBatch: vi.fn(),
        update,
        delete: vi.fn()
      }
    })
    render(withQuery(<JournalPage />))
    await user.click(await screen.findByText('Élève anonymisé'))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ id: ENTRY_ID, activity: ActivityType.WORK })
    })
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty('studentId')
  })
})
