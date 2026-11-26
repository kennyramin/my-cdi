import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/react'
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
