import type Database from 'better-sqlite3'
import { formatLocalDateTime, LOCAL_DATE_TIME_PATTERN } from '@lib/localDateTime'

export const STARTS_AT_LOCAL_DONE_KEY = 'migrations.startsAtLocal.done'

const DONE_VALUE = 'true'
const LEGACY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$/
const COLONLESS_OFFSET_PATTERN = /([+-]\d{2})(\d{2})$/
const OFFSET_WITH_COLON = '$1:$2'

export type NormalizeLegacyStartsAtDeps = {
  createAutomaticBackup: (reason: 'normalization') => Promise<string>
  logger: { info(message: string): void; warn(message: string): void }
}

export type NormalizeLegacyStartsAtResult = {
  status: 'already-done' | 'nothing-to-convert' | 'converted'
  converted: number
  unparseable: number
}

type StartsAtRow = { id: number; starts_at: string }
type Conversion = { id: number; startsAt: string }

function toLocal(value: string): string | null {
  if (!LEGACY_PATTERN.test(value)) {
    return null
  }
  const date = new Date(value.replace(COLONLESS_OFFSET_PATTERN, OFFSET_WITH_COLON))
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return formatLocalDateTime(date)
}

function isDone(sqlite: Database.Database): boolean {
  const row = sqlite
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(STARTS_AT_LOCAL_DONE_KEY)
  return row !== undefined
}

function classify(rows: StartsAtRow[]): { conversions: Conversion[]; unparseable: number } {
  const conversions: Conversion[] = []
  let unparseable = 0
  for (const row of rows) {
    if (LOCAL_DATE_TIME_PATTERN.test(row.starts_at)) {
      continue
    }
    const local = toLocal(row.starts_at)
    if (local === null) {
      unparseable += 1
    } else {
      conversions.push({ id: row.id, startsAt: local })
    }
  }
  return { conversions, unparseable }
}

export async function normalizeLegacyStartsAt(
  sqlite: Database.Database,
  deps: NormalizeLegacyStartsAtDeps
): Promise<NormalizeLegacyStartsAtResult> {
  if (isDone(sqlite)) {
    return { status: 'already-done', converted: 0, unparseable: 0 }
  }

  const rows = sqlite.prepare<[], StartsAtRow>('SELECT id, starts_at FROM frequentation').all()
  const { conversions, unparseable } = classify(rows)

  if (conversions.length > 0) {
    await deps.createAutomaticBackup('normalization')
  }

  const apply = sqlite.transaction(() => {
    const update = sqlite.prepare('UPDATE frequentation SET starts_at = ? WHERE id = ?')
    for (const conversion of conversions) {
      update.run(conversion.startsAt, conversion.id)
    }
    sqlite
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(STARTS_AT_LOCAL_DONE_KEY, DONE_VALUE)
  })
  apply()

  if (unparseable > 0) {
    deps.logger.warn(`Visit timestamps left untouched because unparseable: ${unparseable}`)
  }
  deps.logger.info(`Visit timestamps normalised to local time: ${conversions.length}`)

  return {
    status: conversions.length > 0 ? 'converted' : 'nothing-to-convert',
    converted: conversions.length,
    unparseable
  }
}
