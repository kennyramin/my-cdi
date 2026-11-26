import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { Avatar } from '../Avatar'
import { avatarColor } from '../helpers/avatarColor'

function backgroundOf(container: HTMLElement): string {
  const root = container.firstElementChild
  return root ? getComputedStyle(root).backgroundColor : ''
}

function withTheme(ui: ReactNode) {
  return <ThemeProvider theme={theme}>{ui}</ThemeProvider>
}

describe('Avatar', () => {
  it('renders the initials inside the avatar root', () => {
    render(withTheme(<Avatar initials="MC" colorSeed={0} />))
    expect(screen.getByText('MC')).toBeInTheDocument()
  })

  it('renders an MUI Avatar root', () => {
    const { container } = render(withTheme(<Avatar initials="MC" colorSeed={0} />))
    const root = container.firstElementChild
    expect(root?.className).toMatch(/MuiAvatar-root/)
  })

  it('uses the colorSeed-derived color for the initials and its tint for the background', () => {
    const seed = 3
    const { bg: expected } = avatarColor(seed, theme.palette)
    const probe = document.createElement('div')
    probe.style.color = expected
    const { container } = render(withTheme(<Avatar initials="MC" colorSeed={seed} />))
    const root = container.firstElementChild
    expect(probe.style.color).not.toBe('')
    expect(root).not.toBeNull()
    expect(root ? getComputedStyle(root).color : '').toBe(probe.style.color)
    const rgb = probe.style.color.replace('rgb(', '').replace(')', '')
    expect(backgroundOf(container)).toContain(rgb)
  })

  it('is hidden from assistive technology only when neutral', () => {
    const neutral = render(withTheme(<Avatar initials="?" colorSeed={null} />)).container
    const colored = render(withTheme(<Avatar initials="MC" colorSeed={1} />)).container
    expect(neutral.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(colored.firstElementChild).not.toHaveAttribute('aria-hidden')
  })

  it('neutral ignores colorSeed and uses the disabled background', () => {
    const colored = render(withTheme(<Avatar initials="A" colorSeed={1} />)).container
    const neutralA = render(withTheme(<Avatar initials="?" colorSeed={1} neutral />)).container
    const neutralB = render(withTheme(<Avatar initials="?" colorSeed={2} neutral />)).container
    expect(backgroundOf(neutralA)).toBe(backgroundOf(neutralB))
    expect(backgroundOf(neutralA)).not.toBe(backgroundOf(colored))
  })

  it('falls back to the neutral style when colorSeed is null', () => {
    const a = render(withTheme(<Avatar initials="?" colorSeed={null} />)).container
    const b = render(withTheme(<Avatar initials="?" colorSeed={5} neutral />)).container
    expect(backgroundOf(a)).toBe(backgroundOf(b))
  })

  it('appends custom className', () => {
    const { container } = render(
      withTheme(<Avatar initials="X" colorSeed={0} className="my-extra" />)
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('my-extra')
  })
})
