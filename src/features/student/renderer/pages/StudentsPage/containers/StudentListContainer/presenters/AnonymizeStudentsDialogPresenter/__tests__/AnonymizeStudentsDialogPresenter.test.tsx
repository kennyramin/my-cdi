import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import '@shared/i18n/config'
import { theme } from '@ui/theme'
import { AnonymizeStudentsDialogPresenter } from '../AnonymizeStudentsDialogPresenter'
import type { AnonymizeStudentsDialogPresenterProps } from '../AnonymizeStudentsDialogPresenter'

const TWO_STUDENTS = 2
const THREE_WITHOUT_VISITS = 3
const NONE = 0

function renderDialog(overrides: Partial<AnonymizeStudentsDialogPresenterProps> = {}) {
  const props: AnonymizeStudentsDialogPresenterProps = {
    open: true,
    count: TWO_STUDENTS,
    withoutVisitsCount: NONE,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    isPending: false,
    errorMessage: null,
    ...overrides
  }
  render(
    <ThemeProvider theme={theme}>
      <AnonymizeStudentsDialogPresenter {...props} />
    </ThemeProvider>
  )
  return props
}

function getBackdrop(): Element {
  const backdrop = document.querySelector('.MuiBackdrop-root')
  if (backdrop === null) {
    throw new Error('Backdrop not found')
  }
  return backdrop
}

describe('AnonymizeStudentsDialogPresenter', () => {
  it('shows title, irreversible message and backup note', () => {
    renderDialog()
    expect(screen.getByText('Retirer 2 élèves ?')).toBeInTheDocument()
    expect(screen.getByText(/supprimés définitivement/)).toBeInTheDocument()
    expect(screen.getByText(/irréversible/)).toBeInTheDocument()
    expect(screen.getByText(/copie de sécurité/)).toBeInTheDocument()
    expect(screen.getByText(/environ 30 jours/)).toBeInTheDocument()
  })

  it('mentions what is kept: visits and class', () => {
    renderDialog()
    expect(screen.getByText(/visites et la classe sont conservées/)).toBeInTheDocument()
  })

  it('shows the no-visits note only when withoutVisitsCount > 0', () => {
    renderDialog({ withoutVisitsCount: THREE_WITHOUT_VISITS })
    expect(
      screen.getByText('3 élèves sans visite seront simplement supprimés.')
    ).toBeInTheDocument()
  })

  it('hides the no-visits note when every student has visits', () => {
    renderDialog({ withoutVisitsCount: NONE })
    expect(screen.queryByText(/sans visite/)).toBeNull()
  })

  it('confirm and cancel call their handlers', async () => {
    const user = userEvent.setup()
    const props = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Retirer' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows errorMessage', () => {
    renderDialog({ errorMessage: "L'écriture de la sauvegarde a échoué" })
    expect(screen.getByRole('alert')).toHaveTextContent("L'écriture de la sauvegarde a échoué")
  })

  it('disables the buttons while pending', () => {
    renderDialog({ isPending: true })
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
  })

  it('does not claim visits are kept when no selected student has visits', () => {
    renderDialog({ count: TWO_STUDENTS, withoutVisitsCount: TWO_STUDENTS })
    expect(screen.queryByText(/visites et la classe sont conservées/)).toBeNull()
    expect(screen.getByText(/irréversible/)).toBeInTheDocument()
  })

  it('puts the initial focus on Annuler, not on the destructive button', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Retirer' })).not.toHaveFocus()
  })

  it('closes on Escape, backdrop and the X button when idle', () => {
    const props = renderDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(getBackdrop())
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(props.onClose).toHaveBeenCalledTimes(3)
  })

  it('ignores Escape, backdrop and the X button while pending', () => {
    const props = renderDialog({ isPending: true })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(getBackdrop())
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
