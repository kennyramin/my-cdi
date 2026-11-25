import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PeriodRangeDto } from '@statistics-shared'
import type { CustomRangeError } from '@statistics/types'
import { useCustomRangeInputs } from '../useCustomRangeInputs'
import '@shared/i18n/config'

const RANGE: PeriodRangeDto = { startDate: '2026-11-01', endDate: '2026-11-30' }

interface HarnessProps {
  onCustomRangeChange: (next: PeriodRangeDto) => void
  error: CustomRangeError | null
}

function Harness({ onCustomRangeChange, error }: HarnessProps) {
  const inputs = useCustomRangeInputs(RANGE, onCustomRangeChange, error)
  return (
    <div>
      <input aria-label="start" value={inputs.startDate} onChange={inputs.onStartDateChange} />
      <input aria-label="end" value={inputs.endDate} onChange={inputs.onEndDateChange} />
      <p data-testid="message">{inputs.errorMessage ?? 'none'}</p>
      <p data-testid="invalid">{`${inputs.isStartInvalid}/${inputs.isEndInvalid}`}</p>
    </div>
  )
}

describe('useCustomRangeInputs', () => {
  it('exposes the range values', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error={null} />)
    expect(screen.getByLabelText('start')).toHaveValue('2026-11-01')
    expect(screen.getByLabelText('end')).toHaveValue('2026-11-30')
  })

  it('emits the full range with the start date replaced', () => {
    const onCustomRangeChange = vi.fn()
    render(<Harness onCustomRangeChange={onCustomRangeChange} error={null} />)
    fireEvent.change(screen.getByLabelText('start'), { target: { value: '2026-11-03' } })
    expect(onCustomRangeChange).toHaveBeenCalledWith({
      startDate: '2026-11-03',
      endDate: '2026-11-30'
    })
  })

  it('emits the full range with the end date replaced', () => {
    const onCustomRangeChange = vi.fn()
    render(<Harness onCustomRangeChange={onCustomRangeChange} error={null} />)
    fireEvent.change(screen.getByLabelText('end'), { target: { value: '2026-11-15' } })
    expect(onCustomRangeChange).toHaveBeenCalledWith({
      startDate: '2026-11-01',
      endDate: '2026-11-15'
    })
  })

  it('has no error message without error', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error={null} />)
    expect(screen.getByTestId('message')).toHaveTextContent('none')
  })

  it('translates the incomplete error', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error="incomplete" />)
    expect(screen.getByTestId('message')).toHaveTextContent('Renseignez les deux dates')
  })

  it('translates the endBeforeStart error', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error="endBeforeStart" />)
    expect(screen.getByTestId('message')).toHaveTextContent(
      'La date de fin doit être postérieure ou égale à la date de début'
    )
  })

  it('flags only the end input for endBeforeStart', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error="endBeforeStart" />)
    expect(screen.getByTestId('invalid')).toHaveTextContent('false/true')
  })

  it('flags nothing without error', () => {
    render(<Harness onCustomRangeChange={vi.fn()} error={null} />)
    expect(screen.getByTestId('invalid')).toHaveTextContent('false/false')
  })
})
