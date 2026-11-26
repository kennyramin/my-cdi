import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import { JournalEntryRowPresenter } from '../JournalEntryRowPresenter'
import type { JournalEntryRowPresenterProps } from '../JournalEntryRowPresenter'

const STUDENT_ID = 7
const ENTRY_TIME = '09:00'
const PERIOD_LABEL = 'Matin'

const baseProps: JournalEntryRowPresenterProps = {
  initials: 'JD',
  avatarColorSeed: STUDENT_ID,
  isAnonymized: false,
  displayName: 'Jean Dupont',
  classe: '3ème A',
  time: ENTRY_TIME,
  periodLabel: PERIOD_LABEL,
  period: 'morning' as const,
  activityTone: 'work' as const,
  activityLabel: 'Travail',
  selected: false,
  onSelectChange: vi.fn(),
  onRowClick: vi.fn(),
  onEditClick: vi.fn(),
  onDeleteClick: vi.fn()
}

function renderRow(props: Partial<Parameters<typeof JournalEntryRowPresenter>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <JournalEntryRowPresenter {...baseProps} {...props} />
      </ThemeProvider>
    </I18nextProvider>
  )
}

describe('JournalEntryRowPresenter', () => {
  describe('anonymized entry', () => {
    const anonymizedProps = {
      initials: '?',
      avatarColorSeed: null,
      isAnonymized: true,
      displayName: 'Élève anonymisé',
      classe: '5C'
    }

    it('renders the anonymized label, class, initials "?" and a neutral avatar', () => {
      const { container } = renderRow(anonymizedProps)
      expect(screen.getByText('Élève anonymisé')).toBeInTheDocument()
      expect(screen.getByText('5C')).toBeInTheDocument()
      expect(screen.getByText('?')).toBeInTheDocument()
      expect(container.textContent).not.toMatch(/undefined|null/)
      const avatar = screen.getByText('?')
      const reference = renderRow({ initials: 'AB', avatarColorSeed: 1 })
      const referenceAvatar = reference.getByText('AB')
      expect(referenceAvatar).toHaveClass('MuiAvatar-root')
      expect(getComputedStyle(avatar).backgroundColor).not.toBe(
        getComputedStyle(referenceAvatar).backgroundColor
      )
    })

    it('hides the placeholder avatar from assistive technology', () => {
      renderRow(anonymizedProps)
      expect(screen.getByText('?').closest('[aria-hidden="true"]')).not.toBeNull()
    })

    it('keeps the identified avatar exposed', () => {
      renderRow()
      expect(screen.getByText('JD').closest('[aria-hidden="true"]')).toBeNull()
    })

    it('edit and delete buttons stay enabled', () => {
      renderRow(anonymizedProps)
      expect(screen.getByRole('button', { name: /modifier/i })).toBeEnabled()
      expect(screen.getByRole('button', { name: /supprimer/i })).toBeEnabled()
    })

    it('gives the checkbox a non-empty label with class and time', () => {
      renderRow(anonymizedProps)
      expect(
        screen.getByRole('checkbox', { name: 'Sélectionner un élève anonymisé (5C, 09:00)' })
      ).toBeInTheDocument()
    })
  })

  it('does not use the invalid row role', () => {
    renderRow()
    expect(document.querySelector('[role="row"]')).toBeNull()
  })

  it('renders student name, class, time, and activity label', () => {
    renderRow()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('3ème A')).toBeInTheDocument()
    expect(screen.getByText('Travail')).toBeInTheDocument()
    expect(screen.getByText(ENTRY_TIME)).toBeInTheDocument()
    expect(screen.getByText(PERIOD_LABEL)).toBeInTheDocument()
  })

  it('renders the initials avatar', () => {
    const { container } = renderRow()
    expect(container.textContent).toContain('JD')
  })

  it('exposes the period and activity tone through data attributes', () => {
    renderRow({ period: 'morning', activityTone: 'work' })
    expect(document.querySelector('[data-period="morning"]')).not.toBeNull()
    expect(document.querySelector('[data-tone="work"]')).not.toBeNull()
  })

  it('clicking the row triggers onRowClick', () => {
    const onRowClick = vi.fn()
    renderRow({ onRowClick })
    fireEvent.click(screen.getByRole('listitem'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('clicking the delete IconButton triggers onDeleteClick', () => {
    const onDeleteClick = vi.fn()
    renderRow({ onDeleteClick })
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    expect(onDeleteClick).toHaveBeenCalledTimes(1)
  })

  it('clicking the edit IconButton triggers onEditClick', () => {
    const onEditClick = vi.fn()
    renderRow({ onEditClick })
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }))
    expect(onEditClick).toHaveBeenCalledTimes(1)
  })

  describe('selection checkbox', () => {
    const CHECKBOX_NAME = 'Sélectionner Jean Dupont'

    it('renders a real checkbox named "Sélectionner Jean Dupont"', () => {
      renderRow()
      const box = screen.getByRole('checkbox', { name: CHECKBOX_NAME })
      expect(box).toBeInstanceOf(HTMLInputElement)
      expect(box).toHaveAttribute('type', 'checkbox')
    })

    it('reflects selected through checked', () => {
      const { unmount } = renderRow({ selected: false })
      expect(screen.getByRole('checkbox', { name: CHECKBOX_NAME })).not.toBeChecked()
      unmount()
      renderRow({ selected: true })
      expect(screen.getByRole('checkbox', { name: CHECKBOX_NAME })).toBeChecked()
    })

    it('clicking the checkbox calls onSelectChange once and not onRowClick', async () => {
      const user = userEvent.setup()
      const onSelectChange = vi.fn()
      const onRowClick = vi.fn()
      renderRow({ onSelectChange, onRowClick })
      await user.click(screen.getByRole('checkbox', { name: CHECKBOX_NAME }))
      expect(onSelectChange).toHaveBeenCalledTimes(1)
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('Space on the focused checkbox calls onSelectChange once and not onRowClick or onEditClick', async () => {
      const user = userEvent.setup()
      const onSelectChange = vi.fn()
      const onRowClick = vi.fn()
      const onEditClick = vi.fn()
      renderRow({ onSelectChange, onRowClick, onEditClick })
      await user.tab()
      expect(screen.getByRole('checkbox', { name: CHECKBOX_NAME })).toHaveFocus()
      await user.keyboard(' ')
      expect(onSelectChange).toHaveBeenCalledTimes(1)
      expect(onRowClick).not.toHaveBeenCalled()
      expect(onEditClick).not.toHaveBeenCalled()
    })

    it('Ctrl-click on the checkbox calls onSelectChange once and not onRowClick', () => {
      const onSelectChange = vi.fn()
      const onRowClick = vi.fn()
      renderRow({ onSelectChange, onRowClick })
      fireEvent.click(screen.getByRole('checkbox', { name: CHECKBOX_NAME }), { ctrlKey: true })
      expect(onSelectChange).toHaveBeenCalledTimes(1)
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('tab order is checkbox, edit, delete', async () => {
      const user = userEvent.setup()
      renderRow()
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: CHECKBOX_NAME }))
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Modifier' }))
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Supprimer' }))
    })
  })
})
