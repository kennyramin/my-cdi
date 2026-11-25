import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { PeriodFilterContainer } from '../PeriodFilterContainer'
import '@shared/i18n/config'

const RANGE = { startDate: '2026-11-01', endDate: '2026-11-30' }

function renderFilter(props: Partial<ComponentProps<typeof PeriodFilterContainer>> = {}) {
  return render(
    <PeriodFilterContainer
      value="month"
      onChange={vi.fn()}
      customRange={RANGE}
      customRangeError={null}
      onCustomRangeChange={vi.fn()}
      {...props}
    />
  )
}

describe('PeriodFilterContainer', () => {
  it('renders all six period buttons', () => {
    renderFilter({ value: 'month', onChange: vi.fn() })
    expect(screen.getByText('Cette semaine')).toBeInTheDocument()
    expect(screen.getByText('Ce mois')).toBeInTheDocument()
    expect(screen.getByText('Ce trimestre')).toBeInTheDocument()
    expect(screen.getByText('Ce semestre')).toBeInTheDocument()
    expect(screen.getByText('Année scolaire')).toBeInTheDocument()
    expect(screen.getByText('Personnalisé')).toBeInTheDocument()
  })

  it('marks the selected button with the active style', () => {
    renderFilter({ value: 'quarter', onChange: vi.fn() })
    const button = screen.getByText('Ce trimestre').closest('button')
    expect(button?.getAttribute('data-active')).toBe('true')
  })

  it('calls onChange with the new key when a button is clicked', () => {
    const onChange = vi.fn()
    renderFilter({ value: 'month', onChange: onChange })
    fireEvent.click(screen.getByText('Cette semaine'))
    expect(onChange).toHaveBeenCalledWith('week')
  })

  it('enables the custom button and selects "custom"', () => {
    const onChange = vi.fn()
    renderFilter({ onChange })
    const customButton = screen.getByText('Personnalisé').closest('button')
    expect(customButton).not.toBeDisabled()
    if (customButton) {
      fireEvent.click(customButton)
    }
    expect(onChange).toHaveBeenCalledWith('custom')
  })

  it('hides the date inputs for preset periods', () => {
    renderFilter({ value: 'month' })
    expect(screen.queryByLabelText('Date de début')).toBeNull()
    expect(screen.queryByLabelText('Date de fin')).toBeNull()
  })

  it('shows both date inputs pre-filled when custom is active', () => {
    renderFilter({ value: 'custom' })
    expect(screen.getByLabelText('Date de début')).toHaveValue('2026-11-01')
    expect(screen.getByLabelText('Date de fin')).toHaveValue('2026-11-30')
  })

  it('emits the new range when the end date changes', () => {
    const onCustomRangeChange = vi.fn()
    renderFilter({ value: 'custom', onCustomRangeChange })
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-11-15' } })
    expect(onCustomRangeChange).toHaveBeenCalledWith({
      startDate: '2026-11-01',
      endDate: '2026-11-15'
    })
  })

  it('shows the inverted-range error as an alert linked to the end input', () => {
    renderFilter({ value: 'custom', customRangeError: 'endBeforeStart' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'La date de fin doit être postérieure ou égale à la date de début'
    )
    const end = screen.getByLabelText('Date de fin')
    expect(end).toHaveAttribute('aria-invalid', 'true')
    expect(end).toHaveAttribute('aria-describedby', alert.id)
    expect(screen.getByLabelText('Date de début')).toHaveAttribute('aria-invalid', 'false')
  })

  it('announces an incomplete range politely, never as an alert', () => {
    renderFilter({
      value: 'custom',
      customRange: { startDate: '2026-11-01', endDate: '0002-11-30' },
      customRangeError: 'incomplete'
    })
    expect(screen.queryByRole('alert')).toBeNull()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Renseignez les deux dates')
    const end = screen.getByLabelText('Date de fin')
    expect(end).toHaveAttribute('aria-invalid', 'true')
    expect(end).toHaveAttribute('aria-describedby', status.id)
    expect(screen.getByLabelText('Date de début')).toHaveAttribute('aria-invalid', 'false')
  })

  it('flags the start input when the start date is the incomplete one', () => {
    renderFilter({
      value: 'custom',
      customRange: { startDate: '', endDate: '2026-11-30' },
      customRangeError: 'incomplete'
    })
    expect(screen.getByLabelText('Date de début')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Date de fin')).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows no message when the range is valid', () => {
    renderFilter({ value: 'custom' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Date de fin')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Date de fin')).not.toHaveAttribute('aria-describedby')
  })

  it('bounds both inputs to the plausible years', () => {
    renderFilter({ value: 'custom' })
    expect(screen.getByLabelText('Date de début')).toHaveAttribute('min', '2000-01-01')
    expect(screen.getByLabelText('Date de fin')).toHaveAttribute('max', '2100-12-31')
  })
})
