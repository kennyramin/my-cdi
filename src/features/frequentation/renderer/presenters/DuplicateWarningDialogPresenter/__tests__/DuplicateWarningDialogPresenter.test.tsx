import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import { DuplicateWarningDialogPresenter } from '../DuplicateWarningDialogPresenter'
import { ActivityType } from '@types'
import type { DuplicateWarningDto } from '@frequentation-shared'

const FIRST: DuplicateWarningDto = {
  studentId: 1,
  studentName: 'Léa Martin',
  existingStartsAt: '2026-04-01T14:02:00',
  existingActivity: ActivityType.READING
}
const SECOND: DuplicateWarningDto = {
  studentId: 2,
  studentName: 'Tom Durand',
  existingStartsAt: '2026-04-01T09:05:00',
  existingActivity: ActivityType.WORK
}
const LABELS: Partial<Record<ActivityType, string>> = {
  [ActivityType.READING]: 'Lecture',
  [ActivityType.WORK]: 'Travail'
}
const EN_LABELS: Partial<Record<ActivityType, string>> = {
  [ActivityType.READING]: 'Reading',
  [ActivityType.WORK]: 'Work'
}

function setup(
  duplicates: DuplicateWarningDto[],
  labels: Partial<Record<ActivityType, string>> = LABELS,
  busy = false
) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const ui = (list: DuplicateWarningDto[]) => (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <button>opener</button>
        <DuplicateWarningDialogPresenter
          duplicates={list}
          onConfirm={onConfirm}
          onCancel={onCancel}
          busy={busy}
          getActivityLabel={(a) => labels[a] ?? a}
        />
      </ThemeProvider>
    </I18nextProvider>
  )
  const view = render(ui(duplicates))
  return { onConfirm, onCancel, rerender: (list: DuplicateWarningDto[]) => view.rerender(ui(list)) }
}

describe('DuplicateWarningDialogPresenter', () => {
  afterEach(async () => {
    await i18n.changeLanguage('fr')
  })

  it('renders an accessible dialog with title, singular intro and the line', () => {
    setup([FIRST])
    const dialog = screen.getByRole('dialog', { name: 'Présence déjà enregistrée' })
    expect(
      within(dialog).getByText(/1 élève a déjà une présence à moins de 30 minutes/)
    ).toBeInTheDocument()
    const items = within(dialog).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Léa Martin — déjà enregistrée à 14:02 (Lecture)')
  })

  it('uses the plural intro and one item per duplicate', () => {
    setup([FIRST, SECOND])
    expect(screen.getByText(/2 élèves ont déjà une présence/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Tom Durand — déjà enregistrée à 09:05 (Travail)')).toBeInTheDocument()
  })

  it('renders the english copy', async () => {
    await i18n.changeLanguage('en')
    setup([FIRST], EN_LABELS)
    expect(screen.getByRole('dialog', { name: 'Visit already recorded' })).toBeInTheDocument()
    expect(screen.getByText(/1 student already has a visit within 30 minutes/)).toBeInTheDocument()
    expect(screen.getByText('Léa Martin — already recorded at 14:02 (Reading)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders nothing when there is no duplicate', () => {
    setup([])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onConfirm once from "Enregistrer quand même"', async () => {
    const { onConfirm, onCancel } = setup([FIRST])
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer quand même' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel only from "Annuler"', async () => {
    const { onConfirm, onCancel } = setup([FIRST])
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel only on Escape', async () => {
    const { onConfirm, onCancel } = setup([FIRST])
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('puts focus on the safe action "Annuler" when opened', () => {
    setup([FIRST])
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('returns focus to the opener once closed', async () => {
    const { rerender } = setup([])
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()
    rerender([FIRST])
    const dialog = await screen.findByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    rerender([])
    await vi.waitFor(() => expect(opener).toHaveFocus())
  })

  it('keeps the last list while closing and never shows a zero count', () => {
    const { rerender } = setup([FIRST])
    rerender([])
    expect(screen.queryByText(/^0 /)).not.toBeInTheDocument()
    expect(screen.getByText('Léa Martin — déjà enregistrée à 14:02 (Lecture)')).toBeInTheDocument()
  })

  it('disables the confirm button while busy', () => {
    setup([FIRST], LABELS, true)
    expect(screen.getByRole('button', { name: 'Enregistrer quand même' })).toBeDisabled()
  })
})
