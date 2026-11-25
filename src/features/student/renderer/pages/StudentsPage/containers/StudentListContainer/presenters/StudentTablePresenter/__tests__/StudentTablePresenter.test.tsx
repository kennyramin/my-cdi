import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@ui/theme'
import { StudentTablePresenter } from '../StudentTablePresenter'
import { StudentTableRowPresenter } from '../../StudentTableRowPresenter'
import type { StudentTableRowPresenterProps } from '../../StudentTableRowPresenter'
import type { StudentViewModel } from '@student/types'

const ID_FIRST = 1
const ID_SECOND = 2

const STUDENTS: StudentViewModel[] = [
  {
    id: ID_FIRST,
    nom: 'Dupont',
    prenom: 'Jean',
    classe: '3ème A',
    ine: '111A',
    fullName: 'Jean Dupont',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0,
    displayName: 'Jean Dupont',
    classLabel: '3ème A'
  },
  {
    id: ID_SECOND,
    nom: 'Martin',
    prenom: 'Marie',
    classe: '3ème B',
    ine: '222B',
    fullName: 'Marie Martin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    visitCount: 0,
    displayName: 'Marie Martin',
    classLabel: '3ème B'
  }
]

function buildRowProps(student: StudentViewModel, selected = false): StudentTableRowPresenterProps {
  return {
    student,
    initials: 'JD',
    selected,
    onCheckboxChange: () => {},
    onCheckboxClick: () => {},
    onEditClick: () => {},
    onDeleteClick: () => {}
  }
}

function buildHeaderNodes(): ReactNode[] {
  return [
    <th key="checkbox" />,
    <th key="nom">Nom</th>,
    <th key="prenom">Prénom</th>,
    <th key="classe">Classe</th>,
    <th key="ine">INE</th>,
    <th key="visits">Visites</th>,
    <th key="actions">Actions</th>
  ]
}

describe('StudentTablePresenter', () => {
  it('renders student row nodes', () => {
    render(
      <ThemeProvider theme={theme}>
        <StudentTablePresenter
          headerNodes={buildHeaderNodes()}
          rowNodes={STUDENTS.map((student) => (
            <StudentTableRowPresenter key={student.id} {...buildRowProps(student)} />
          ))}
          countLabel="2 élèves"
          emptyMessage={null}
        />
      </ThemeProvider>
    )

    expect(screen.getByText('Dupont')).toBeInTheDocument()
    expect(screen.getByText('Jean')).toBeInTheDocument()
    expect(screen.getByText('3ème A')).toBeInTheDocument()
    expect(screen.getByText('2 élèves')).toBeInTheDocument()
  })

  it('renders the header nodes it receives', () => {
    render(
      <ThemeProvider theme={theme}>
        <StudentTablePresenter
          headerNodes={buildHeaderNodes()}
          rowNodes={[]}
          countLabel="0 élève"
          emptyMessage={null}
        />
      </ThemeProvider>
    )

    expect(screen.getByText('Nom')).toBeInTheDocument()
    expect(screen.getByText('Prénom')).toBeInTheDocument()
    expect(screen.getByText('Classe')).toBeInTheDocument()
    expect(screen.getByText('INE')).toBeInTheDocument()
  })

  it('renders an empty message cell spanning all columns when there are no rows', () => {
    render(
      <ThemeProvider theme={theme}>
        <StudentTablePresenter
          headerNodes={buildHeaderNodes()}
          rowNodes={[]}
          countLabel="0 élève"
          emptyMessage="Aucun élève"
        />
      </ThemeProvider>
    )

    expect(screen.getByRole('cell', { name: 'Aucun élève' })).toHaveAttribute('colspan', '7')
  })

  it('does not render the empty message when rows are present', () => {
    render(
      <ThemeProvider theme={theme}>
        <StudentTablePresenter
          headerNodes={buildHeaderNodes()}
          rowNodes={STUDENTS.map((student) => (
            <StudentTableRowPresenter key={student.id} {...buildRowProps(student)} />
          ))}
          countLabel="2 élèves"
          emptyMessage="Aucun élève"
        />
      </ThemeProvider>
    )

    expect(screen.queryByRole('cell', { name: 'Aucun élève' })).not.toBeInTheDocument()
  })

  it('uses a fixed table layout', () => {
    render(
      <ThemeProvider theme={theme}>
        <StudentTablePresenter
          headerNodes={buildHeaderNodes()}
          rowNodes={[]}
          countLabel="0 élève"
          emptyMessage={null}
        />
      </ThemeProvider>
    )

    expect(screen.getByRole('table')).toHaveStyle({ tableLayout: 'fixed' })
  })
})
