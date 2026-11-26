import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '@shared/i18n/config'
import { theme } from '@ui/theme'
import { EditEntryFieldsPresenter } from '../EditEntryFieldsPresenter'

const TODAY = '2026-04-01'
const STUDENT_ID = 7

function renderFields(overrides: Partial<Parameters<typeof EditEntryFieldsPresenter>[0]> = {}) {
  const props = {
    date: TODAY,
    time: '09:30',
    maxDate: TODAY,
    isFuture: false,
    onDateChange: vi.fn(),
    onTimeChange: vi.fn(),
    studentOptions: [{ value: STUDENT_ID, label: 'Alice Martin', badge: '6e A' }],
    studentInputValue: 'Alice Martin',
    onStudentInputChange: vi.fn(),
    onStudentSelect: vi.fn(),
    studentLocked: false,
    ...overrides
  }
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <EditEntryFieldsPresenter {...props} />
      </ThemeProvider>
    </I18nextProvider>
  )
  return props
}

describe('EditEntryFieldsPresenter', () => {
  it('shows labelled date, time and student fields with their values', () => {
    renderFields()
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY)
    expect(screen.getByLabelText('Heure')).toHaveValue('09:30')
    expect(screen.getByRole('combobox', { name: 'Élève' })).toHaveValue('Alice Martin')
  })

  it('caps the date input at maxDate', () => {
    renderFields()
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', TODAY)
  })

  it('reports date and time changes', () => {
    const props = renderFields()
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-31' } })
    fireEvent.change(screen.getByLabelText('Heure'), { target: { value: '10:15' } })
    expect(props.onDateChange).toHaveBeenCalledWith('2026-03-31')
    expect(props.onTimeChange).toHaveBeenCalledWith('10:15')
  })

  it('shows the future helper text and flags both inputs invalid', () => {
    renderFields({ isFuture: true })
    expect(screen.getByText("Impossible d'enregistrer une présence dans le futur")).toBeVisible()
    expect(screen.getByLabelText('Date')).toBeInvalid()
    expect(screen.getByLabelText('Heure')).toBeInvalid()
  })

  it('disables the student field with the locked helper text when anonymized', () => {
    renderFields({ studentLocked: true, studentInputValue: 'Élève anonymisé' })
    expect(screen.getByRole('combobox', { name: 'Élève' })).toBeDisabled()
    expect(
      screen.getByText('Un élève anonymisé ne peut pas être réassocié à une personne.')
    ).toBeInTheDocument()
  })

  it('does not show the locked helper text for a regular student', () => {
    renderFields()
    expect(screen.queryByText(/ne peut pas être réassocié/)).not.toBeInTheDocument()
  })
})
