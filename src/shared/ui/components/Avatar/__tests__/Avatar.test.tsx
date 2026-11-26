import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import type { ReactNode } from 'react'
import { Avatar } from '../Avatar'
import { avatarColor } from '../helpers/avatarColor'

function bg(container: HTMLElement): string {
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

  it('uses the colorSeed-derived hex value as the background and foreground', () => {
    const seed = 3
    const { bg } = avatarColor(seed, theme.palette)
    expect(bg).toBeTruthy()
  })

  it('neutral ignores colorSeed and uses the disabled background', () => {
    const colored = render(withTheme(<Avatar initials="A" colorSeed={1} />)).container
    const neutralA = render(withTheme(<Avatar initials="?" colorSeed={1} neutral />)).container
    const neutralB = render(withTheme(<Avatar initials="?" colorSeed={2} neutral />)).container
    expect(bg(neutralA)).toBe(bg(neutralB))
    expect(bg(neutralA)).not.toBe(bg(colored))
  })

  it('falls back to the neutral style when colorSeed is null', () => {
    const a = render(withTheme(<Avatar initials="?" colorSeed={null} />)).container
    const b = render(withTheme(<Avatar initials="?" colorSeed={5} neutral />)).container
    expect(bg(a)).toBe(bg(b))
  })

  it('appends custom className', () => {
    const { container } = render(
      withTheme(<Avatar initials="X" colorSeed={0} className="my-extra" />)
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('my-extra')
  })
})
