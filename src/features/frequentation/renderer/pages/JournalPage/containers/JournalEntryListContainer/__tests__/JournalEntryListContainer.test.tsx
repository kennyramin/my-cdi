import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { JournalEntryListContainer } from '../JournalEntryListContainer'
import { ActivityType } from '@types'

const MOCK_ENTRY_COUNT = 2
const SELECT_ALL = 'Tout sélectionner'

const deleteMock = vi.fn()
const updateMock = vi.fn()

function buildDto(id: number, prenom: string, nom: string, startsAt: string) {
  return {
    frequentation: {
      id,
      startsAt,
      activity: ActivityType.WORK,
      studentId: id,
      studentName: `${prenom} ${nom}`,
      studentClass: '3A',
      studentIne: `INE-${id}`,
      createdAt: startsAt,
      updatedAt: startsAt
    },
    student: { id, nom, prenom, classe: '3A', ine: `INE-${id}` }
  }
}

function withProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('JournalEntryListContainer', () => {
  beforeEach(() => {
    deleteMock.mockReset().mockResolvedValue({ success: true, data: true })
    updateMock.mockReset().mockResolvedValue({ success: true, data: {} })
    vi.stubGlobal('electronAPI', {
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({
          success: true,
          data: [
            buildDto(1, 'Jean', 'Dupont', '2026-04-01T09:00:00'),
            buildDto(2, 'Marie', 'Martin', '2026-04-01T14:00:00')
          ]
        }),
        delete: deleteMock,
        update: updateMock
      }
    })
  })

  it('renders attendance rows for the selected date', async () => {
    render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    await waitFor(() => expect(screen.getByText('Jean Dupont')).toBeInTheDocument())
  })

  it('renders entries as items of a labelled list', async () => {
    render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    const list = await screen.findByRole('list', { name: 'Présents' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(MOCK_ENTRY_COUNT)
  })

  it('renders no list when the day has no entries', async () => {
    vi.stubGlobal('electronAPI', {
      frequentation: {
        getJournalEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        delete: deleteMock,
        update: updateMock
      }
    })
    render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    expect(
      await screen.findByText(i18n.t('noEntries', { ns: 'frequentation' }))
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('selects only visible entries when clicking Tout sélectionner', async () => {
    const user = userEvent.setup()
    render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    await screen.findByText('Jean Dupont')
    const searchbox = screen.getByRole('searchbox', { name: 'Rechercher…' })
    await user.type(searchbox, 'Marie')
    await user.click(screen.getByRole('button', { name: SELECT_ALL }))
    expect(screen.getByText('1 entrée sélectionnée')).toBeInTheDocument()
    await user.clear(searchbox)
    expect(screen.getByText('1 entrée sélectionnée')).toBeInTheDocument()
    await user.type(searchbox, 'Marie')
    await user.click(screen.getByRole('button', { name: 'Supprimer la sélection' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteMock).toHaveBeenCalledWith({ id: 2 })
  })

  it('ignores hidden selected entries in counter and batch actions', async () => {
    const user = userEvent.setup()
    render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    await screen.findByText('Jean Dupont')
    await user.click(screen.getByRole('button', { name: SELECT_ALL }))
    expect(screen.getByText('2 entrées sélectionnées')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher…' }), 'Marie')
    expect(screen.getByText('1 entrée sélectionnée')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "Modifier l'activité" }))
    await user.click(screen.getAllByRole('menuitem').at(0) ?? document.body)
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock.mock.calls.at(0)?.at(0)).toMatchObject({ id: 2 })
  })

  it('clears selection when selectedDate changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-01" onEditEntry={vi.fn()} />)
    )
    await screen.findByText('Jean Dupont')
    await user.click(screen.getByRole('button', { name: SELECT_ALL }))
    expect(screen.getByText('2 entrées sélectionnées')).toBeInTheDocument()
    rerender(
      withProviders(<JournalEntryListContainer selectedDate="2026-04-02" onEditEntry={vi.fn()} />)
    )
    await screen.findByText('Jean Dupont')
    expect(screen.queryByText(/sélectionnée/)).toBeNull()
    expect(screen.getByRole('button', { name: SELECT_ALL })).toBeInTheDocument()
  })

  describe('row checkboxes', () => {
    const JEAN_BOX = 'Sélectionner Jean Dupont'
    const MARIE_BOX = 'Sélectionner Marie Martin'
    const ONE_SELECTED = '1 entrée sélectionnée'

    function renderList(onEditEntry = vi.fn(), selectedDate = '2026-04-01') {
      return render(
        withProviders(
          <JournalEntryListContainer selectedDate={selectedDate} onEditEntry={onEditEntry} />
        )
      )
    }

    it('checking a row checkbox selects that entry and shows the counter', async () => {
      const user = userEvent.setup()
      renderList()
      await user.click(await screen.findByRole('checkbox', { name: MARIE_BOX }))
      expect(screen.getByText(ONE_SELECTED)).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: MARIE_BOX })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: JEAN_BOX })).not.toBeChecked()
    })

    it('unchecking removes the entry from the selection', async () => {
      const user = userEvent.setup()
      renderList()
      const box = await screen.findByRole('checkbox', { name: MARIE_BOX })
      await user.click(box)
      await user.click(box)
      expect(screen.queryByText(/sélectionnée/)).toBeNull()
    })

    it('plain row click opens edit and never toggles', async () => {
      const user = userEvent.setup()
      const onEditEntry = vi.fn()
      renderList(onEditEntry)
      await user.click(await screen.findByText('Jean Dupont'))
      expect(onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
      expect(screen.getByRole('checkbox', { name: JEAN_BOX })).not.toBeChecked()
      expect(screen.queryByText(/sélectionnée/)).toBeNull()
    })

    it.each(['Control', 'Meta'])(
      '%s-click on the row toggles without opening edit',
      async (modifier) => {
        const user = userEvent.setup()
        const onEditEntry = vi.fn()
        renderList(onEditEntry)
        const name = await screen.findByText('Jean Dupont')
        await user.keyboard(`{${modifier}>}`)
        await user.click(name)
        await user.keyboard(`{/${modifier}}`)
        expect(screen.getByRole('checkbox', { name: JEAN_BOX })).toBeChecked()
        expect(onEditEntry).not.toHaveBeenCalled()
      }
    )

    it('Ctrl-click directly on the checkbox toggles exactly once', async () => {
      const user = userEvent.setup()
      const onEditEntry = vi.fn()
      renderList(onEditEntry)
      const box = await screen.findByRole('checkbox', { name: JEAN_BOX })
      await user.keyboard('{Control>}')
      await user.click(box)
      await user.keyboard('{/Control}')
      expect(screen.getByText(ONE_SELECTED)).toBeInTheDocument()
      expect(box).toBeChecked()
      expect(onEditEntry).not.toHaveBeenCalled()
    })

    it('Tout sélectionner checks every visible checkbox', async () => {
      const user = userEvent.setup()
      renderList()
      await screen.findByText('Jean Dupont')
      await user.click(screen.getByRole('button', { name: SELECT_ALL }))
      screen.getAllByRole('checkbox').forEach((box) => expect(box).toBeChecked())
    })

    it('Tout sélectionner with a search checks only the visible checkbox', async () => {
      const user = userEvent.setup()
      renderList()
      await screen.findByText('Jean Dupont')
      await user.type(screen.getByRole('searchbox', { name: 'Rechercher…' }), 'Marie')
      await user.click(screen.getByRole('button', { name: SELECT_ALL }))
      expect(screen.queryByRole('checkbox', { name: JEAN_BOX })).toBeNull()
      expect(screen.getByRole('checkbox', { name: MARIE_BOX })).toBeChecked()
    })

    it('same-name entries toggle independently', async () => {
      const user = userEvent.setup()
      vi.stubGlobal('electronAPI', {
        frequentation: {
          getJournalEntries: vi.fn().mockResolvedValue({
            success: true,
            data: [
              buildDto(1, 'Jean', 'Dupont', '2026-04-01T09:00:00'),
              buildDto(2, 'Marie', 'Martin', '2026-04-01T14:00:00'),
              buildDto(3, 'Jean', 'Dupont', '2026-04-01T15:00:00')
            ]
          }),
          delete: deleteMock,
          update: updateMock
        }
      })
      renderList()
      await screen.findByText('Marie Martin')
      const boxes = await screen.findAllByRole('checkbox', { name: JEAN_BOX })
      expect(boxes).toHaveLength(2)
      await user.click(boxes.at(1) ?? document.body)
      expect(boxes.at(0)).not.toBeChecked()
      expect(boxes.at(1)).toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Supprimer la sélection' }))
      await user.click(await screen.findByRole('button', { name: 'Confirmer' }))
      await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
      expect(deleteMock).toHaveBeenCalledWith({ id: 3 })
    })

    it('clears the checked state when selectedDate changes', async () => {
      const user = userEvent.setup()
      const { rerender } = renderList()
      await screen.findByText('Jean Dupont')
      await user.click(screen.getByRole('button', { name: SELECT_ALL }))
      rerender(
        withProviders(<JournalEntryListContainer selectedDate="2026-04-02" onEditEntry={vi.fn()} />)
      )
      await screen.findByText('Jean Dupont')
      screen.getAllByRole('checkbox').forEach((box) => expect(box).not.toBeChecked())
    })
  })
})
