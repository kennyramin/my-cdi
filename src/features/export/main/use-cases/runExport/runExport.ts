import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { ExportRequestDto, ExportResultDto } from '@export-shared'
import { AppError, ErrorCode } from '@lib/errors'
import { formatLocalDate } from '@lib/localDateTime'
import type { UseCaseResult } from '@lib/use-case'
import { getStatsForPeriod } from '@statistics/use-cases/getStatsForPeriod'
import type { StatsForPeriodDto } from '@statistics-shared'
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
import type { ExportFileAdapter } from '../../ports'
import { exportRequestSchema } from '../../validations/exportRequestSchema'

export const EXPORT_CHUNK_ROWS = 5000

const VALIDATION_FALLBACK_MESSAGE = 'Validation error'
const WRITE_FAILED_MESSAGE = 'Export file could not be written'
const DATA_FAILED_MESSAGE = 'Export data could not be read'
const NO_PERIOD_MESSAGE = 'Export period is missing'

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
  request: ExportRequestDto
): Promise<RowSource> {
  if (request.period === undefined) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, NO_PERIOD_MESSAGE)
  }
  const stats = await getStatsForPeriod(frequentationGateway, request.period)
  if (!stats.success) {
    throw new AppError(ErrorCode.DATABASE_ERROR, DATA_FAILED_MESSAGE)
  }
  return aggregatedSource(request.kind, stats.data)
}

function aggregatedSource(kind: ExportRequestDto['kind'], stats: StatsForPeriodDto): RowSource {
  if (kind === 'visitsByDay') {
    return fromRows(DAY_HEADER, buildDayRows(stats))
  }
  if (kind === 'visitsByActivity') {
    return fromRows(ACTIVITY_HEADER, buildActivityRows(stats))
  }
  return fromRows(CLASS_HEADER, buildClassRows(stats))
}

async function loadJournal(
  frequentationGateway: FrequentationGateway,
  request: ExportRequestDto
): Promise<RowSource> {
  if (request.period === undefined) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, NO_PERIOD_MESSAGE)
  }
  const entries = await frequentationGateway.getByDateRange(
    request.period.startDate,
    request.period.endDate
  )
  const sorted = [...entries].sort((left, right) =>
    left.startsAt === right.startsAt ? left.id - right.id : left.startsAt < right.startsAt ? -1 : 1
  )
  const { includeNames } = request
  return {
    header: journalHeader(includeNames),
    count: sorted.length,
    slice: (start, end) =>
      sorted.slice(start, end).map((entry) => buildJournalRow(entry, includeNames))
  }
}

async function loadStudents(studentGateway: StudentGateway): Promise<RowSource> {
  const students = await studentGateway.getAllWithVisitCount()
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
  if (request.kind === 'journal') {
    return loadJournal(deps.frequentationGateway, request)
  }
  return loadAggregated(deps.frequentationGateway, request)
}

async function writeRows(
  deps: RunExportDeps,
  path: string,
  source: RowSource
): Promise<UseCaseResult<ExportResultDto>> {
  let writer
  try {
    writer = await deps.fileAdapter.openWriter(path)
  } catch {
    return failWrite()
  }
  try {
    await writer.write(serializeCsvHeader(source.header))
    for (let start = 0; start < source.count; start += EXPORT_CHUNK_ROWS) {
      await writer.write(serializeCsvRows(source.slice(start, start + EXPORT_CHUNK_ROWS)))
    }
    await writer.commit()
  } catch {
    try {
      await writer.abort()
    } catch {
      // the original failure is the one worth reporting
    }
    return failWrite()
  }
  return { success: true, data: { path, rows: source.count } }
}

function failWrite(): UseCaseResult<ExportResultDto> {
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
