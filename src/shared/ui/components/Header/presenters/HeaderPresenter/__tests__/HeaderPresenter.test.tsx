import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeaderPresenter } from '../HeaderPresenter'

describe('HeaderPresenter', () => {
  it('renders the title, subtitle and time', () => {
    render(<HeaderPresenter title="Journal" subtitle="Sous-titre" time="08:30" />)
    expect(screen.getByText('Journal')).toBeInTheDocument()
    expect(screen.getByText('Sous-titre')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
  })

  it('renders inside a banner role', () => {
    render(<HeaderPresenter title="Journal" subtitle="x" time="08:30" />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders the page title as the level-1 heading', () => {
    render(<HeaderPresenter title="Journal" subtitle="x" time="08:30" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
