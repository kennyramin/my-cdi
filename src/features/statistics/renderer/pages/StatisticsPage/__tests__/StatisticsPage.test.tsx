import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { ActivityType } from '@types'
import { StatisticsPage } from '../StatisticsPage'
import { buildPeriodRange } from '../helpers/buildPeriodRange'
import { formatDate } from '@ui/helpers/formatDate'
import '@shared/i18n/config'

const SAMPLE_TOTAL = 12
const SAMPLE_AVERAGE = 2.4
const SAMPLE_MORNING = 60
const SAMPLE_AFTERNOON = 40

function createWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </QueryClientProvider>
    )
  }
}

describe('StatisticsPage', () => {
  const getStats = vi.fn()
  beforeEach(() => {
    getStats.mockReset()
    vi.stubGlobal('electronAPI', {
      statistics: {
        getStats: getStats.mockResolvedValue({
          success: true,
          data: {
            totalVisits: SAMPLE_TOTAL,
            averagePerDay: SAMPLE_AVERAGE,
            morningRate: SAMPLE_MORNING,
            afternoonRate: SAMPLE_AFTERNOON,
            dailyCounts: [{ date: '2026-04-27', count: SAMPLE_TOTAL }],
            activityCounts: [{ activity: ActivityType.WORK, count: SAMPLE_TOTAL }],
            classCounts: []
          }
        })
      }
    })
  })

  it('renders the loading state initially', () => {
    render(<StatisticsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  it('renders KPI labels, period filter and chart titles once stats load', async () => {
    render(<StatisticsPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
    expect(screen.getByText('Moyenne / jour')).toBeInTheDocument()
    expect(screen.getByText('Ce mois')).toBeInTheDocument()
    expect(screen.getByText('Fréquentation par jour de la semaine')).toBeInTheDocument()
    expect(screen.getByText('Fréquentation par classe')).toBeInTheDocument()
    expect(screen.getByText('Activités')).toBeInTheDocument()
    expect(screen.getByText('Évolution sur la période')).toBeInTheDocument()
  })

  it('keeps the custom inputs mounted while the new range loads', async () => {
    render(<StatisticsPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Personnalisé'))
    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-11-10' } })
    expect(screen.getByLabelText('Date de début')).toHaveValue('2026-11-10')
    expect(screen.queryByText('Chargement…')).toBeNull()
    await waitFor(() =>
      expect(getStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: '2026-11-10' })
      )
    )
  })

  function trendLabels() {
    const svg = screen.getByRole('img', { name: 'Évolution sur la période' })
    return [...svg.querySelectorAll('text')].map((node) => node.textContent)
  }

  function staleArea(container: HTMLElement) {
    return container.querySelector('[data-stale="true"][aria-busy="true"]')
  }

  it('keeps the last valid range labels and marks content stale for an inverted range', async () => {
    const { container } = render(<StatisticsPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
    const labelsBefore = trendLabels()
    expect(staleArea(container)).toBeNull()
    fireEvent.click(screen.getByText('Personnalisé'))
    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-11-10' } })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(trendLabels()).toEqual(labelsBefore)
    expect(staleArea(container)).not.toBeNull()
  })

  it('does not draw the new range labels over old dots while a preset is pending', async () => {
    const { container } = render(<StatisticsPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
    const labelsBefore = trendLabels()
    let resolveWeek: (value: unknown) => void = () => undefined
    getStats.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWeek = resolve
      })
    )
    fireEvent.click(screen.getByText('Cette semaine'))
    expect(trendLabels()).toEqual(labelsBefore)
    expect(staleArea(container)).not.toBeNull()
    await act(async () => {
      resolveWeek({
        success: true,
        data: {
          totalVisits: 1,
          averagePerDay: 1,
          morningRate: 0,
          afternoonRate: 0,
          dailyCounts: [],
          activityCounts: [],
          classCounts: []
        }
      })
    })
    await waitFor(() => expect(staleArea(container)).toBeNull())
  })

  describe('export button', () => {
    it('shows the Exporter button', async () => {
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
    })

    it('is disabled and described by the range error when the custom range is invalid', async () => {
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Personnalisé'))
      fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-11-20' } })
      fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-11-10' } })
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
      const button = screen.getByRole('button', { name: 'Exporter' })
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription(
        'La date de fin doit être postérieure ou égale à la date de début'
      )
    })

    it('stays available while stats are loading and when loading failed', async () => {
      getStats.mockResolvedValue({ success: false, error: 'boom' })
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await screen.findByRole('button', { name: 'Réessayer' })
      expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled()
    })

    it('gives the dialog the custom range as-is', async () => {
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Personnalisé'))
      fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-11-10' } })
      fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-11-20' } })
      fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))
      expect(await screen.findByText('Période : du 10/11/2026 au 20/11/2026')).toBeInTheDocument()
    })

    it('gives the dialog the school-year period when "Année scolaire" is selected', async () => {
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await waitFor(() => expect(screen.getByText('Visites totales')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Année scolaire'))
      const { startDate, endDate } = buildPeriodRange('schoolYear')
      fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))
      expect(
        await screen.findByText(`Période : du ${formatDate(startDate)} au ${formatDate(endDate)}`)
      ).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    const failure = { success: false, error: 'boom' }
    const successResult = {
      success: true,
      data: {
        totalVisits: SAMPLE_TOTAL,
        averagePerDay: SAMPLE_AVERAGE,
        morningRate: SAMPLE_MORNING,
        afternoonRate: SAMPLE_AFTERNOON,
        dailyCounts: [],
        activityCounts: [],
        classCounts: []
      }
    }

    it('shows the error state instead of the loader when the query fails with no data', async () => {
      getStats.mockResolvedValue(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('boom')
      expect(screen.queryByText('Chargement…')).toBeNull()
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
      expect(screen.getByText('Ce mois')).toBeInTheDocument()
    })

    it('retry reloads and shows the stats', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
      expect(await screen.findByText('Visites totales')).toBeInTheDocument()
    })

    it('disables Réessayer while the retry is pending', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toBeDisabled())
    })

    it('re-enables Réessayer when the retry fails again', async () => {
      getStats.mockResolvedValue(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
      await waitFor(() => expect(getStats).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled())
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('keeps the stats and shows a non-blocking line when a refetch fails', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const Wrapper = createWrapper(queryClient)
      getStats.mockResolvedValue(successResult)
      const first = render(<StatisticsPage />, { wrapper: Wrapper })
      expect(await screen.findByText('Visites totales')).toBeInTheDocument()
      first.unmount()
      getStats.mockResolvedValue(failure)
      render(<StatisticsPage />, { wrapper: Wrapper })
      expect(screen.getByText('Visites totales')).toBeInTheDocument()
      const status = await screen.findByRole('status')
      expect(status).toHaveTextContent("Les données affichées n'ont pas pu être actualisées : boom")
      expect(screen.getByText('Visites totales')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('keeps the period filter usable when there is no data and the custom range is invalid', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await screen.findByRole('button', { name: 'Réessayer' })
      fireEvent.click(screen.getByText('Personnalisé'))
      // The first edit already inverts the range (start after the month end):
      // a valid range without data would show the loader, as for any first load.
      fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-12-05' } })
      fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-11-10' } })
      await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
      expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
      expect(screen.getByLabelText('Date de début')).toBeInTheDocument()
      expect(getStats).not.toHaveBeenCalledWith({
        startDate: '2026-12-05',
        endDate: '2026-11-10'
      })
    })

    it('keeps the period filter mounted when Personnalisé is clicked after a failure', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await screen.findByRole('button', { name: 'Réessayer' })
      getStats.mockReturnValue(new Promise(() => undefined))
      const monthButton = screen.getByRole('button', { name: 'Ce mois' })
      fireEvent.click(screen.getByText('Personnalisé'))
      expect(screen.getByLabelText('Date de début')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ce mois' })).toBe(monthButton)
    })

    it('keeps the same focused period filter element when data arrives after a failure', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await screen.findByRole('button', { name: 'Réessayer' })
      const weekButton = screen.getByRole('button', { name: 'Cette semaine' })
      weekButton.focus()
      getStats.mockResolvedValue(successResult)
      fireEvent.click(weekButton)
      await screen.findByText('Visites totales')
      expect(screen.getByRole('button', { name: 'Cette semaine' })).toBe(weekButton)
      expect(document.activeElement).toBe(weekButton)
    })

    it('keeps the date input mounted and focused while a valid custom range loads', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      await screen.findByRole('button', { name: 'Réessayer' })
      getStats.mockReturnValue(new Promise(() => undefined))
      fireEvent.click(screen.getByText('Personnalisé'))
      const start = screen.getByLabelText('Date de début')
      start.focus()
      fireEvent.change(start, { target: { value: '2026-11-20' } })
      await waitFor(() => expect(screen.getByText('Chargement…')).toBeInTheDocument())
      expect(screen.getByLabelText('Date de début')).toBe(start)
      expect(document.activeElement).toBe(start)
    })

    it('shows the loader, not the old failure, when the period changes during a retry', async () => {
      getStats.mockResolvedValueOnce(failure)
      render(<StatisticsPage />, { wrapper: createWrapper() })
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
      getStats.mockReturnValue(new Promise(() => undefined))
      getStats.mockReturnValueOnce(new Promise(() => undefined))
      fireEvent.click(screen.getByText('Cette semaine'))
      expect(screen.getByText('Chargement…')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
    })
  })
})
