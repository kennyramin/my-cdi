import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import '@shared/i18n/config'
import { theme } from '@ui/theme'
import { StudentTableRowPresenter } from '../StudentTableRowPresenter'
import type { StudentViewModel } from '@student/types'

const STUDENT_ID = 1
const VISIT_COUNT = 12
const NO_VISITS = 0

function buildStudent(visitCount: number): StudentViewModel {
  return {
    id: STUDENT_ID,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: '111A',
    fullName: 'Jean Dupont',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount,
    displayName: 'Jean Dupont',
    classLabel: '3ème A'
  }
}

function renderRow(student: StudentViewModel) {
  return render(
    <ThemeProvider theme={theme}>
      <table>
        <tbody>
          <StudentTableRowPresenter
            student={student}
            initials="JD"
            selected={false}
            onCheckboxChange={() => {}}
            onCheckboxClick={() => {}}
            onEditClick={() => {}}
            onDeleteClick={() => {}}
          />
        </tbody>
      </table>
    </ThemeProvider>
  )
}

describe('StudentTableRowPresenter', () => {
  it('renders the visit count', () => {
    renderRow(buildStudent(VISIT_COUNT))
    expect(screen.getByText(String(VISIT_COUNT))).toBeInTheDocument()
  })

  it('renders 0 for a student without visits', () => {
    renderRow(buildStudent(NO_VISITS))
    expect(screen.getByText(String(NO_VISITS))).toBeInTheDocument()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('labels the row checkbox input with the student name', () => {
    renderRow({
      ...buildStudent(NO_VISITS),
      prenom: 'Léa',
      nom: 'Martin',
      displayName: 'Léa Martin'
    })
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Léa Martin' })).toBeInTheDocument()
  })
})
