import type { ExportKind } from '@export-shared'
import type { PeriodRangeDto } from '@statistics-shared'

const FILE_NAME_PREFIX = 'mon-cdi'
const FILE_EXTENSION = '.csv'
const SEGMENT_SEPARATOR = '-'
const PERIOD_SEPARATOR = '_'
const FALLBACK_FILE_NAME = 'export'
const RESERVED_NAME_PREFIX = '_'
const MAX_FILE_NAME_LENGTH = 200
const FIRST_PRINTABLE_CODE = 32
const DELETE_CODE = 127

const EXPORT_KIND_SLUGS: Record<ExportKind, string> = {
  journal: 'journal',
  visitsByDay: 'visites-par-jour',
  visitsByActivity: 'visites-par-activite',
  visitsByClass: 'visites-par-classe',
  students: 'eleves'
}

const PERIOD_KINDS: readonly ExportKind[] = [
  'journal',
  'visitsByDay',
  'visitsByActivity',
  'visitsByClass'
]

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
const WINDOWS_RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

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

const defuseReservedName = (name: string): string => {
  return WINDOWS_RESERVED_DEVICE_NAME.test(name) ? `${RESERVED_NAME_PREFIX}${name}` : name
}

const capLength = (name: string): string => {
  if (name.length <= MAX_FILE_NAME_LENGTH) {
    return name
  }
  const { stem, extension } = splitExtension(name)
  return `${stem.slice(0, MAX_FILE_NAME_LENGTH - extension.length)}${extension}`
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
    period !== undefined && PERIOD_KINDS.includes(kind)
      ? `${period.startDate}${PERIOD_SEPARATOR}${period.endDate}`
      : today
  return sanitizeFileName(
    [FILE_NAME_PREFIX, EXPORT_KIND_SLUGS[kind], datePart].join(SEGMENT_SEPARATOR) + FILE_EXTENSION
  )
}
