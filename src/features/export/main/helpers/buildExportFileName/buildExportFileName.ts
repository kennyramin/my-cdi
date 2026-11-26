import { isPeriodExportKind, type ExportKind } from '@export-shared'
import type { PeriodRangeDto } from '@statistics-shared'

const FILE_NAME_PREFIX = 'mon-cdi'
const FILE_EXTENSION = '.csv'
const SEGMENT_SEPARATOR = '-'
const PERIOD_SEPARATOR = '_'
const FALLBACK_FILE_NAME = 'export'
const RESERVED_NAME_PREFIX = '_'
const MAX_FILE_NAME_BYTES = 200
const FIRST_PRINTABLE_CODE = 32
const DELETE_CODE = 127

const EXPORT_KIND_SLUGS: Record<ExportKind, string> = {
  journal: 'journal',
  visitsByDay: 'visites-par-jour',
  visitsByActivity: 'visites-par-activite',
  visitsByClass: 'visites-par-classe',
  students: 'eleves'
}

const WINDOWS_FORBIDDEN_CHARACTERS: readonly string[] = [
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '|',
  '?',
  '*'
]
const TRAILING_DOTS_AND_SPACES = /[. ]+$/
const WINDOWS_RESERVED_DEVICE_NAME =
  /^(con|prn|aux|nul|conin\$|conout\$|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]) *(\..*)?$/i
const textEncoder = new TextEncoder()

const isForbiddenCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0)
  return (
    WINDOWS_FORBIDDEN_CHARACTERS.includes(character) ||
    code < FIRST_PRINTABLE_CODE ||
    code === DELETE_CODE
  )
}

const splitExtension = (name: string): { stem: string; extension: string } => {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex > 0
    ? { stem: name.slice(0, dotIndex), extension: name.slice(dotIndex) }
    : { stem: name, extension: '' }
}

const defuseReservedName = (name: string): string =>
  WINDOWS_RESERVED_DEVICE_NAME.test(name) ? `${RESERVED_NAME_PREFIX}${name}` : name

const byteLength = (text: string): number => textEncoder.encode(text).length

const truncateToBytes = (text: string, maxBytes: number): string => {
  let usedBytes = 0
  let kept = ''
  for (const character of text) {
    usedBytes += byteLength(character)
    if (usedBytes > maxBytes) {
      return kept
    }
    kept += character
  }
  return kept
}

const capLength = (name: string): string => {
  if (byteLength(name) <= MAX_FILE_NAME_BYTES) {
    return name
  }
  const { stem, extension } = splitExtension(name)
  const stemBudget = MAX_FILE_NAME_BYTES - byteLength(extension)
  return stemBudget > 0
    ? `${truncateToBytes(stem, stemBudget)}${extension}`
    : truncateToBytes(name, MAX_FILE_NAME_BYTES)
}

export const sanitizeFileName = (name: string): string => {
  const replaced = [...name]
    .map((character) => (isForbiddenCharacter(character) ? SEGMENT_SEPARATOR : character))
    .join('')
  const trimmed = capLength(replaced).replace(TRAILING_DOTS_AND_SPACES, '')
  return trimmed === '' ? FALLBACK_FILE_NAME : defuseReservedName(trimmed)
}

export const buildExportFileName = (input: {
  kind: ExportKind
  period?: PeriodRangeDto
  today: string
}): string => {
  const { kind, period, today } = input
  const datePart =
    period !== undefined && isPeriodExportKind(kind)
      ? `${period.startDate}${PERIOD_SEPARATOR}${period.endDate}`
      : today
  return sanitizeFileName(
    [FILE_NAME_PREFIX, EXPORT_KIND_SLUGS[kind], datePart].join(SEGMENT_SEPARATOR) + FILE_EXTENSION
  )
}
