import { describe, it, expect, vi } from 'vitest'
import Papa from 'papaparse'
import { ActivityType } from '@types'
import { ErrorCode } from '@lib/errors'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentWithVisitCountEntity } from '@student/entities/student'
import { CSV_BOM, CSV_EOL } from '../../../helpers/csv'
import { createFakeExportFileAdapter } from '../../../test-helpers'
import type { FakeExportFileAdapter } from '../../../test-helpers'
import { EXPORT_CHUNK_ROWS, runExport } from '../runExport'

const PERIOD = { startDate: '2026-03-01', endDate: '2026-03-31' }
const PATH = '/exports/out.csv'
const NAME = 'Dupont'
const INE = '123456789AB'
const BIG_ROW_COUNT = 60000
const SECOND_WRITE = 2
const NAME_COLUMNS_FROM_END = -3
const NOW = new Date('2026-11-25T10:00:00')

const entry = (
  overrides: Partial<FrequentationWithStudentEntity> = {}
): FrequentationWithStudentEntity => ({
  id: 1,
  startsAt: '2026-03-05T09:07:00',
  activity: ActivityType.READING,
  studentId: 1,
  studentNom: NAME,
  studentPrenom: 'Léa',
  studentClasse: '6A',
  studentIne: INE,
  createdAt: '2026-03-05T09:07:00',
  updatedAt: '2026-03-05T09:07:00',
  ...overrides
})

const student = (
  overrides: Partial<StudentWithVisitCountEntity> = {}
): StudentWithVisitCountEntity => ({
  id: 1,
  nom: NAME,
  prenom: 'Léa',
  classe: '3-B',
  ine: INE,
  createdAt: '',
  updatedAt: '',
  visitCount: 4,
  ...overrides
})

const frequentationGateway = (
  entries: FrequentationWithStudentEntity[],
  fail = false
): FrequentationGateway => ({
  create: vi.fn(),
  createManyChecked: vi.fn(),
  updateChecked: vi.fn(),
  getById: vi.fn(),
  getWithStudentById: vi.fn(),
  getAll: vi.fn(),
  getByStudentId: vi.fn(),
  getByDateRange: fail
    ? vi.fn().mockRejectedValue(new Error('db down'))
    : vi.fn().mockResolvedValue(entries),
  update: vi.fn(),
  delete: vi.fn(),
  deleteByStudentId: vi.fn(),
  count: vi.fn()
})

const studentGateway = (students: StudentWithVisitCountEntity[]): StudentGateway => ({
  create: vi.fn(),
  getById: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getByIds: vi.fn(),
  getAllWithVisitCount: vi.fn().mockResolvedValue(students),
  countVisitsByStudentId: vi.fn(),
  anonymizeByIds: vi.fn(),
  checkpoint: vi.fn(),
  withTransaction: vi.fn()
})

interface Setup {
  entries?: FrequentationWithStudentEntity[]
  students?: StudentWithVisitCountEntity[]
  adapter?: FakeExportFileAdapter
  failFetch?: boolean
}

const setup = (options: Setup = {}) => {
  const adapter = options.adapter ?? createFakeExportFileAdapter({ path: PATH })
  const deps = {
    frequentationGateway: frequentationGateway(options.entries ?? [entry()], options.failFetch),
    studentGateway: studentGateway(options.students ?? [student()]),
    fileAdapter: adapter,
    now: () => NOW
  }
  return { adapter, deps }
}

const parse = (text: string): string[][] =>
  Papa.parse<string[]>(text.slice(CSV_BOM.length), { delimiter: ';' }).data.filter(
    (row) => !(row.length === 1 && row[0] === '')
  )

const journalRequest = { kind: 'journal', period: PERIOD, includeNames: false }
const studentsRequest = { kind: 'students', includeNames: true, acknowledgedPersonalData: true }

describe('runExport', () => {
  it('returns only { path, rows } and nothing else', async () => {
    const { deps } = setup()
    const result = await runExport(deps, journalRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(['path', 'rows'])
      expect(result.data).toEqual({ path: PATH, rows: 1 })
    }
  })

  it('cancelled dialog writes nothing and returns { cancelled: true }', async () => {
    const adapter = createFakeExportFileAdapter({ path: null })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toEqual({ success: true, data: { cancelled: true } })
    expect(adapter.openedPaths).toEqual([])
    expect(adapter.files.size).toBe(0)
  })

  it('empty period writes header only and reports rows: 0', async () => {
    const { adapter, deps } = setup({ entries: [] })
    const result = await runExport(deps, journalRequest)
    expect(result).toEqual({ success: true, data: { path: PATH, rows: 0 } })
    expect(adapter.text(PATH)).toBe(`${CSV_BOM}date;heure;classe;activité${CSV_EOL}`)
    expect(adapter.files.get(PATH)?.committed).toBe(true)
  })

  it.each([
    { kind: 'journal', period: PERIOD, includeNames: false },
    { kind: 'visitsByDay', period: PERIOD, includeNames: false },
    { kind: 'visitsByActivity', period: PERIOD, includeNames: false },
    { kind: 'visitsByClass', period: PERIOD, includeNames: false },
    studentsRequest
  ])('file text starts with BOM and uses CRLF for $kind', async (request) => {
    const { adapter, deps } = setup()
    await runExport(deps, request)
    const text = adapter.text(PATH)
    expect(text.startsWith(CSV_BOM)).toBe(true)
    expect(text.indexOf(CSV_BOM, 1)).toBe(-1)
    expect(text.endsWith(CSV_EOL)).toBe(true)
    expect(/(?<!\r)\n/.test(text)).toBe(false)
  })

  it('journal without names has no nom/prénom/INE column', async () => {
    const { adapter, deps } = setup()
    await runExport(deps, journalRequest)
    const rows = parse(adapter.text(PATH))
    expect(rows).toEqual([
      ['date', 'heure', 'classe', 'activité'],
      ['2026-03-05', '09:07', '6A', expect.any(String)]
    ])
    expect(adapter.text(PATH)).not.toContain(NAME)
    expect(adapter.text(PATH)).not.toContain(INE)
  })

  it('journal with names includes them', async () => {
    const { adapter, deps } = setup()
    await runExport(deps, { ...journalRequest, includeNames: true })
    const rows = parse(adapter.text(PATH))
    expect(rows[0]).toEqual(['date', 'heure', 'classe', 'activité', 'nom', 'prénom', 'INE'])
    expect(rows[1]?.slice(NAME_COLUMNS_FROM_END)).toEqual([NAME, 'Léa', INE])
  })

  it.each(['visitsByDay', 'visitsByActivity', 'visitsByClass'])(
    'aggregated kind %s never contains names even when includeNames: true is sent',
    async (kind) => {
      const { adapter, deps } = setup()
      await runExport(deps, { kind, period: PERIOD, includeNames: true })
      const text = adapter.text(PATH)
      expect(text).not.toContain(NAME)
      expect(text).not.toContain(INE)
      expect(text).not.toContain('Léa')
    }
  )

  it('students export without acknowledgedPersonalData is refused', async () => {
    const { adapter, deps } = setup()
    const result = await runExport(deps, { kind: 'students', includeNames: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(result.error.length).toBeGreaterThan(0)
    }
    expect(adapter.pickedDefaultNames).toEqual([])
    expect(adapter.openedPaths).toEqual([])
    expect(deps.studentGateway.getAllWithVisitCount).not.toHaveBeenCalled()
  })

  it('students export with acknowledgement contains names, classes, INE, visit counts', async () => {
    const { adapter, deps } = setup()
    const result = await runExport(deps, studentsRequest)
    expect(result).toEqual({ success: true, data: { path: PATH, rows: 1 } })
    expect(parse(adapter.text(PATH))).toEqual([
      ['nom', 'prénom', 'classe', 'INE', 'visites'],
      [NAME, 'Léa', '3-B', INE, '4']
    ])
  })

  it('anonymized entries export the label and an empty INE', async () => {
    const anonymous = entry({
      studentId: null,
      studentNom: null,
      studentPrenom: null,
      studentIne: null
    })
    const { adapter, deps } = setup({ entries: [anonymous] })
    await runExport(deps, { ...journalRequest, includeNames: true })
    expect(parse(adapter.text(PATH))[1]?.slice(NAME_COLUMNS_FROM_END)).toEqual([
      ANONYMIZED_STUDENT_LABEL,
      '',
      ''
    ])
  })

  it('uses snapshot class', async () => {
    const { adapter, deps } = setup({ entries: [entry({ studentClasse: '5B' })] })
    await runExport(deps, journalRequest)
    expect(parse(adapter.text(PATH))[1]?.[2]).toBe('5B')
  })

  it('hostile names are quoted/guarded in the file', async () => {
    const hostile = entry({
      studentNom: '=cmd|x',
      studentPrenom: 'Jean;"Pierre"',
      studentIne: '+123',
      studentClasse: 'a\nb'
    })
    const { adapter, deps } = setup({ entries: [hostile] })
    await runExport(deps, { ...journalRequest, includeNames: true })
    const row = parse(adapter.text(PATH))[1]
    expect(row?.[2]).toBe('a\nb')
    expect(row?.slice(NAME_COLUMNS_FROM_END)).toEqual(["'=cmd|x", 'Jean;"Pierre"', "'+123"])
  })

  it('60 000-row journal is written in chunks', async () => {
    const entries = Array.from({ length: BIG_ROW_COUNT }, (_, index) => entry({ id: index + 1 }))
    const { adapter, deps } = setup({ entries })
    const result = await runExport(deps, journalRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(['path', 'rows'])
      expect(result.data).toEqual({ path: PATH, rows: BIG_ROW_COUNT })
    }
    const chunks = adapter.files.get(PATH)?.chunks ?? []
    expect(chunks.length).toBeGreaterThanOrEqual(BIG_ROW_COUNT / EXPORT_CHUNK_ROWS)
    for (const chunk of chunks.slice(1)) {
      expect(chunk.split(CSV_EOL).length - 1).toBeLessThanOrEqual(EXPORT_CHUNK_ROWS)
    }
    expect(parse(adapter.text(PATH)).length).toBe(BIG_ROW_COUNT + 1)
  })

  it('journal rows are sorted by startsAt then id', async () => {
    const entries = [
      entry({ id: 3, startsAt: '2026-03-06T08:00:00', studentClasse: 'C' }),
      entry({ id: 2, startsAt: '2026-03-05T08:00:00', studentClasse: 'B' }),
      entry({ id: 1, startsAt: '2026-03-05T08:00:00', studentClasse: 'A' })
    ]
    const { adapter, deps } = setup({ entries })
    await runExport(deps, journalRequest)
    expect(
      parse(adapter.text(PATH))
        .slice(1)
        .map((row) => row[2])
    ).toEqual(['A', 'B', 'C'])
  })

  it('default file name proposed to the dialog is Windows-safe and matches the journal pattern', async () => {
    const { adapter, deps } = setup()
    await runExport(deps, journalRequest)
    expect(adapter.pickedDefaultNames).toEqual(['mon-cdi-journal-2026-03-01_2026-03-31.csv'])
    expect(adapter.pickedDefaultNames[0]).not.toMatch(/[<>:"/\\|?*]/)
  })

  it('students default name uses today from the injected clock', async () => {
    const { adapter, deps } = setup()
    await runExport(deps, studentsRequest)
    expect(adapter.pickedDefaultNames).toEqual(['mon-cdi-eleves-2026-11-25.csv'])
  })

  it('unwritable target: openWriter throws, typed EXPORT_WRITE_FAILED, nothing committed', async () => {
    const adapter = createFakeExportFileAdapter({ path: PATH, failOnOpen: true })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.files.get(PATH)).toBeUndefined()
  })

  it('write fails midway: abort called, EXPORT_WRITE_FAILED', async () => {
    const adapter = createFakeExportFileAdapter({ path: PATH, failOnWriteNumber: SECOND_WRITE })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.files.get(PATH)).toMatchObject({ aborted: true, committed: false })
  })

  it('commit fails: abort called', async () => {
    const adapter = createFakeExportFileAdapter({ path: PATH, failOnCommit: true })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.files.get(PATH)).toMatchObject({ aborted: true, committed: false })
  })

  it.each([
    { label: 'write failure', options: { failOnWriteNumber: SECOND_WRITE } },
    { label: 'commit failure', options: { failOnCommit: true } }
  ])('a rejecting abort() is swallowed after a $label', async ({ options }) => {
    const adapter = createFakeExportFileAdapter({ path: PATH, failOnAbort: true, ...options })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.files.get(PATH)?.abortCalls).toBe(1)
    expect(adapter.files.get(PATH)?.committed).toBe(false)
  })

  it('header write failure: nothing committed, abort called, no partial file', async () => {
    const adapter = createFakeExportFileAdapter({ path: PATH, failOnWriteNumber: 1 })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.files.get(PATH)).toMatchObject({ aborted: true, committed: false, chunks: [] })
  })

  it('aggregated rows are sorted deterministically whatever the stats order', async () => {
    const { adapter, deps } = setup({
      entries: [
        entry({
          id: 1,
          startsAt: '2026-03-07T08:00:00',
          activity: ActivityType.READING,
          studentClasse: 'B'
        }),
        entry({
          id: 2,
          startsAt: '2026-03-05T08:00:00',
          activity: ActivityType.GAME,
          studentClasse: 'A'
        }),
        entry({
          id: 3,
          startsAt: '2026-03-06T08:00:00',
          activity: ActivityType.READING,
          studentClasse: 'C'
        })
      ].reverse()
    })
    await runExport(deps, { kind: 'visitsByDay', period: PERIOD, includeNames: false })
    expect(
      parse(adapter.text(PATH))
        .slice(1)
        .map((row) => row[0])
    ).toEqual(['2026-03-05', '2026-03-06', '2026-03-07'])
    await runExport(deps, { kind: 'visitsByClass', period: PERIOD, includeNames: false })
    const classRows = parse(adapter.text(PATH)).slice(1)
    expect(classRows.map((row) => row[0])).toEqual(['A', 'B', 'C'])
    await runExport(deps, { kind: 'visitsByActivity', period: PERIOD, includeNames: false })
    const activityRows = parse(adapter.text(PATH)).slice(1)
    const labels = activityRows.map((row) => row[0] ?? '')
    expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right, 'fr')))
  })

  it('students are sorted by nom, prénom then id', async () => {
    const { adapter, deps } = setup({
      students: [
        student({ id: 4, nom: 'Martin', prenom: 'Zoé', ine: 'D' }),
        student({ id: 3, nom: 'Dupont', prenom: 'Léa', ine: 'C' }),
        student({ id: 2, nom: 'Dupont', prenom: 'Léa', ine: 'B' }),
        student({ id: 1, nom: 'Dupont', prenom: 'Abel', ine: 'A' })
      ]
    })
    await runExport(deps, studentsRequest)
    expect(
      parse(adapter.text(PATH))
        .slice(1)
        .map((row) => row[3])
    ).toEqual(['A', 'B', 'C', 'D'])
  })

  it('validation failures carry the schema message, not a generic one', async () => {
    const { deps } = setup()
    const missingAck = await runExport(deps, { kind: 'students', includeNames: true })
    const missingPeriod = await runExport(deps, { kind: 'journal', includeNames: false })
    expect(missingAck).toMatchObject({ success: false, error: 'ACKNOWLEDGEMENT_REQUIRED' })
    expect(missingPeriod).toMatchObject({ success: false, error: 'PERIOD_REQUIRED' })
  })

  it('dialog failure returns EXPORT_WRITE_FAILED without opening a file', async () => {
    const adapter = createFakeExportFileAdapter({ failOnPick: true })
    const { deps } = setup({ adapter })
    const result = await runExport(deps, journalRequest)
    expect(result).toMatchObject({ success: false, code: ErrorCode.EXPORT_WRITE_FAILED })
    expect(adapter.openedPaths).toEqual([])
  })

  it.each([
    { kind: 'nope', period: PERIOD, includeNames: false },
    { kind: 'journal', includeNames: false },
    { kind: 'visitsByDay', includeNames: false }
  ])('invalid request %j never reaches the dialog', async (request) => {
    const { adapter, deps } = setup()
    const result = await runExport(deps, request)
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
    expect(adapter.pickedDefaultNames).toEqual([])
  })

  it.each([
    { kind: 'journal', period: PERIOD, includeNames: false },
    { kind: 'visitsByDay', period: PERIOD, includeNames: false }
  ])('gateway failure for $kind returns a failure without opening the dialog', async (request) => {
    const { adapter, deps } = setup({ failFetch: true })
    const result = await runExport(deps, request)
    expect(result).toMatchObject({ success: false, code: ErrorCode.DATABASE_ERROR })
    expect(adapter.pickedDefaultNames).toEqual([])
    expect(adapter.openedPaths).toEqual([])
  })
})
