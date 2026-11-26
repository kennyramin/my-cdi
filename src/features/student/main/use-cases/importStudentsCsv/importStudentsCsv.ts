import type { StudentGateway } from '@student/gateways/student'
import type { StudentEntity } from '@student/entities/student'
import { parseStudentCsv } from './helpers/parseStudentCsv'
import { normalizeIne } from './helpers/normalizeIne'
import { planCsvRemoval } from './helpers/planCsvRemoval'
import { isRemovalConfirmed, requiresRemovalConfirmation } from '@student-shared'
import type {
  CsvDuplicateInePolicy,
  CsvImportError,
  CsvImportResult,
  ImportStudentsCsvPayload
} from '@student-shared'
import { z } from 'zod'
import log from 'electron-log/main'
import { ErrorCode } from '@lib/errors'
import type { UseCaseResult } from '@lib/use-case'

const importStudentsCsvSchema = z.object({
  csv: z.string(),
  onDuplicateIne: z.enum(['skip', 'replace']).optional(),
  removeAbsent: z.boolean().optional(),
  removalConfirmation: z.string().optional()
})

const ANONYMIZATION_BACKUP_REASON = 'anonymization'
const DEFAULT_DUPLICATE_POLICY: CsvDuplicateInePolicy = 'skip'
const REMOVAL_DUPLICATE_POLICY: CsvDuplicateInePolicy = 'replace'
const NO_REMOVAL_COUNT = 0

interface ImportStudentsCsvDeps {
  gateway: StudentGateway
  createAutomaticBackup: (reason: typeof ANONYMIZATION_BACKUP_REASON) => Promise<string>
}

interface RemovalOutcome {
  anonymized: number
  deletedWithoutVisits: number
}

const NO_REMOVAL: RemovalOutcome = {
  anonymized: NO_REMOVAL_COUNT,
  deletedWithoutVisits: NO_REMOVAL_COUNT
}

function failure(
  error: string,
  code: ErrorCode
): { success: false; error: string; code: ErrorCode } {
  return { success: false, error, code }
}

export async function importStudentsCsv(
  deps: ImportStudentsCsvDeps,
  // Untrusted IPC payload: validated at runtime below
  input: unknown
): Promise<UseCaseResult<CsvImportResult>> {
  const payload = importStudentsCsvSchema.safeParse(input)
  if (!payload.success) {
    return failure('Invalid import payload', ErrorCode.VALIDATION_ERROR)
  }
  return runImport(deps, payload.data)
}

async function runImport(
  deps: ImportStudentsCsvDeps,
  input: ImportStudentsCsvPayload
): Promise<UseCaseResult<CsvImportResult>> {
  const removeAbsent = input.removeAbsent === true
  const duplicatePolicy = removeAbsent
    ? REMOVAL_DUPLICATE_POLICY
    : (input.onDuplicateIne ?? DEFAULT_DUPLICATE_POLICY)
  const parsed = parseStudentCsv(input.csv)
  const { data: rows, errors: parseErrors } = parsed

  if (!removeAbsent && parseErrors.length > 0 && rows.length === 0) {
    return {
      success: true,
      data: {
        created: 0,
        updated: 0,
        errors: parseErrors.length,
        errorDetails: parseErrors
      }
    }
  }

  const existingStudents = await deps.gateway.getAll()

  // Fixed from the pre-import state: a student present in the file is never in this list,
  // even when its update fails later.
  let removeIds: number[] = []
  if (removeAbsent) {
    const { blockedReason, toRemove } = planCsvRemoval(existingStudents, parsed)
    if (blockedReason !== undefined) {
      return failure(`Removal blocked: ${blockedReason}`, ErrorCode.VALIDATION_ERROR)
    }
    if (
      requiresRemovalConfirmation(toRemove.length, existingStudents.length) &&
      !isRemovalConfirmed(input.removalConfirmation, toRemove.length)
    ) {
      return failure('Removal confirmation missing or incorrect', ErrorCode.VALIDATION_ERROR)
    }
    removeIds = toRemove.map((student) => student.id)
    if (removeIds.length > NO_REMOVAL_COUNT) {
      try {
        await deps.createAutomaticBackup(ANONYMIZATION_BACKUP_REASON)
      } catch {
        return failure('Failed to create the safety backup', ErrorCode.BACKUP_WRITE_FAILED)
      }
    }
  }

  const existingByIne = new Map<string, StudentEntity>(
    existingStudents.map((student) => [normalizeIne(student.ine), student])
  )

  const seenInes = new Set<string>()
  let created = 0
  let updated = 0
  const rowErrors: CsvImportError[] = [...parseErrors]
  let removal: RemovalOutcome = NO_REMOVAL

  try {
    removal = await deps.gateway.withTransaction(async (): Promise<RemovalOutcome> => {
      for (const row of rows) {
        const normalisedIne = normalizeIne(row.ine)

        // Two rows of the same file with the same INE are contradictory: always skip
        // and report, regardless of the duplicate policy.
        if (seenInes.has(normalisedIne)) {
          rowErrors.push({
            type: 'DUPLICATE_INE',
            studentName: `${row.prenom} ${row.nom}`
          })
          continue
        }

        const existingStudent = existingByIne.get(normalisedIne)

        if (existingStudent !== undefined) {
          if (duplicatePolicy === 'replace') {
            seenInes.add(normalisedIne)
            try {
              await deps.gateway.update(existingStudent.id, {
                nom: row.nom,
                prenom: row.prenom,
                classe: row.classe
              })
              updated += 1
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error'
              rowErrors.push({
                type: 'DATABASE_ERROR',
                studentName: `${row.prenom} ${row.nom}`,
                message
              })
            }
          } else {
            rowErrors.push({
              type: 'DUPLICATE_INE',
              studentName: `${row.prenom} ${row.nom}`,
              existingName: `${existingStudent.prenom} ${existingStudent.nom}`,
              existingClasse: existingStudent.classe
            })
          }
          continue
        }

        try {
          await deps.gateway.create(row)
          created += 1
          seenInes.add(normalisedIne)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          rowErrors.push({
            type: 'DATABASE_ERROR',
            studentName: `${row.prenom} ${row.nom}`,
            message
          })
        }
      }

      if (removeIds.length === NO_REMOVAL_COUNT) {
        return NO_REMOVAL
      }
      return deps.gateway.anonymizeByIds(removeIds)
    })
  } catch (error) {
    // Counts only: no student data in the logs
    log.error('CSV import rolled back', {
      rows: rows.length,
      removals: removeIds.length,
      cause: error instanceof Error ? error.message : 'Unknown error'
    })
    return failure('Failed to import students', ErrorCode.DATABASE_ERROR)
  }

  if (removeIds.length > NO_REMOVAL_COUNT) {
    // Outside the transaction: flush zeroed pages so no personal data stays in the WAL
    await deps.gateway.checkpoint()
  }

  return {
    success: true,
    data: {
      created,
      updated,
      errors: rowErrors.length,
      errorDetails: rowErrors,
      ...(removeAbsent && {
        anonymized: removal.anonymized,
        deletedWithoutVisits: removal.deletedWithoutVisits
      })
    }
  }
}
