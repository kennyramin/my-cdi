import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { ExportRequestDto, ExportResultDto } from '@export-shared'
import { AppError, ErrorCode } from '@lib/errors'
import { formatLocalDate } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import { getStatsForPeriod } from '@statistics/use-cases/getStatsForPeriod'
import type { PeriodRangeDto, StatsForPeriodDto } from '@statistics-shared'
import { ACTIVITY_EXPORT_LABELS } from '../../helpers/exportRows'
import { buildExportFileName } from '../../helpers/buildExportFileName'
import { serializeCsvHeader, serializeCsvRows } from '../../helpers/csv'
import {
  ACTIVITY_HEADER,
  CLASS_HEADER,
  DAY_HEADER,
  STUDENTS_HEADER,
  buildActivityRows,
  buildClassRows,
  buildDayRows,
  buildJournalRow,
  buildStudentRow,
  journalHeader
} from '../../helpers/exportRows'
import type { CsvRow } from '../../helpers/exportRows'
import type { ExportFileAdapter, ExportWriter } from '../../ports'
import { EXPORT_ISSUE_MESSAGES, exportRequestSchema } from '../../validations/exportRequestSchema'

export const EXPORT_CHUNK_ROWS = 5000

const VALIDATION_FALLBACK_MESSAGE = 'Validation error'
const LOCKED_MESSAGE = 'Export file is locked by another program'
const WRITE_FAILED_MESSAGE = 'Export file could not be written'
const DATA_FAILED_MESSAGE = 'Export data could not be read'
const FRENCH_LOCALE = 'fr'
const collator = new Intl.Collator(FRENCH_LOCALE)

export interface RunExportDeps {
  frequentationGateway: FrequentationGateway
  studentGateway: StudentGateway
  fileAdapter: ExportFileAdapter
  now?: () => Date
}

interface RowSource {
  header: CsvRow
  count: number
  slice(start: number, end: number): CsvRow[]
}

const fromRows = (header: CsvRow, rows: CsvRow[]): RowSource => ({
  header,
  count: rows.length,
  slice: (start, end) => rows.slice(start, end)
})

async function loadAggregated(
  frequentationGateway: FrequentationGateway,
  kind: ExportRequestDto['kind'],
  period: PeriodRangeDto
): Promise<RowSource> {
  const stats = await getStatsForPeriod(frequentationGateway, period)
  if (!stats.success) {
    throw new AppError(ErrorCode.DATABASE_ERROR, DATA_FAILED_MESSAGE)
  }
  return aggregatedSource(kind, stats.data)
}

const compareText = (left: string, right: string): number => {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function aggregatedSource(kind: ExportRequestDto['kind'], stats: StatsForPeriodDto): RowSource {
  if (kind === 'visitsByDay') {
    const dailyCounts = [...stats.dailyCounts].sort((left, right) =>
      compareText(left.date, right.date)
    )
    return fromRows(DAY_HEADER, buildDayRows({ ...stats, dailyCounts }))
  }
  if (kind === 'visitsByActivity') {
    const activityCounts = [...stats.activityCounts].sort(
      (left, right) =>
        collator.compare(
          ACTIVITY_EXPORT_LABELS[left.activity],
          ACTIVITY_EXPORT_LABELS[right.activity]
        ) || left.count - right.count
    )
    return fromRows(ACTIVITY_HEADER, buildActivityRows({ ...stats, activityCounts }))
  }
  const classCounts = [...stats.classCounts].sort(
    (left, right) => collator.compare(left.classe, right.classe) || left.count - right.count
  )
  return fromRows(CLASS_HEADER, buildClassRows({ ...stats, classCounts }))
}

async function loadJournal(
  frequentationGateway: FrequentationGateway,
  period: PeriodRangeDto,
  includeNames: boolean
): Promise<RowSource> {
  const entries = await frequentationGateway.getByDateRange(period.startDate, period.endDate)
  const sorted = [...entries].sort((left, right) =>
    left.startsAt === right.startsAt ? left.id - right.id : left.startsAt < right.startsAt ? -1 : 1
  )
  return {
    header: journalHeader(includeNames),
    count: sorted.length,
    slice: (start, end) =>
      sorted.slice(start, end).map((entry) => buildJournalRow(entry, includeNames))
  }
}

async function loadStudents(studentGateway: StudentGateway): Promise<RowSource> {
  const students = [...(await studentGateway.getAllWithVisitCount())].sort(
    (left, right) =>
      collator.compare(left.nom, right.nom) ||
      collator.compare(left.prenom, right.prenom) ||
      left.id - right.id
  )
  return {
    header: STUDENTS_HEADER,
    count: students.length,
    slice: (start, end) => students.slice(start, end).map(buildStudentRow)
  }
}

function loadRows(deps: RunExportDeps, request: ExportRequestDto): Promise<RowSource> {
  if (request.kind === 'students') {
    return loadStudents(deps.studentGateway)
  }
  const { period } = request
  if (period === undefined) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, EXPORT_ISSUE_MESSAGES.PERIOD_REQUIRED)
  }
  if (request.kind === 'journal') {
    return loadJournal(deps.frequentationGateway, period, request.includeNames)
  }
  return loadAggregated(deps.frequentationGateway, request.kind, period)
}

async function writeRows(
  deps: RunExportDeps,
  path: string,
  source: RowSource
): Promise<UseCaseResult<ExportResultDto>> {
  let writer: ExportWriter
  try {
    writer = await deps.fileAdapter.openWriter(path)
  } catch (error) {
    return failWrite(error)
  }
  try {
    await writer.write(serializeCsvHeader(source.header))
    for (let start = 0; start < source.count; start += EXPORT_CHUNK_ROWS) {
      await writer.write(serializeCsvRows(source.slice(start, start + EXPORT_CHUNK_ROWS)))
    }
    await writer.commit()
  } catch (error) {
    try {
      await writer.abort()
    } catch {
      // the original failure is the one worth reporting
    }
    return failWrite(error)
  }
  return { success: true, data: { path, rows: source.count } }
}

function failWrite(cause?: unknown): UseCaseResult<ExportResultDto> {
  if (cause instanceof AppError && cause.code === ErrorCode.EXPORT_FILE_LOCKED) {
    return { success: false, error: LOCKED_MESSAGE, code: ErrorCode.EXPORT_FILE_LOCKED }
  }
  return { success: false, error: WRITE_FAILED_MESSAGE, code: ErrorCode.EXPORT_WRITE_FAILED }
}

export async function runExport(
  deps: RunExportDeps,
  input: unknown
): Promise<UseCaseResult<ExportResultDto>> {
  const parsed = exportRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? VALIDATION_FALLBACK_MESSAGE,
      code: ErrorCode.VALIDATION_ERROR
    }
  }
  const request = parsed.data

  let source: RowSource
  try {
    source = await loadRows(deps, request)
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message, code: error.code }
    }
    return { success: false, error: DATA_FAILED_MESSAGE, code: ErrorCode.DATABASE_ERROR }
  }

  const today = formatLocalDate((deps.now ?? (() => new Date()))())
  let path: string | null
  try {
    path = await deps.fileAdapter.pickSavePath(
      buildExportFileName({ kind: request.kind, period: request.period, today })
    )
  } catch {
    return failWrite()
  }
  if (path === null) {
    return { success: true, data: { cancelled: true } }
  }
  return writeRows(deps, path, source)
}
