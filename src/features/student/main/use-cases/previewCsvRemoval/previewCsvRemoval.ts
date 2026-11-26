import { z } from 'zod'
import { ErrorCode } from '@lib/errors'
import type { UseCaseResult } from '@lib/use-case'
import type { StudentEntity } from '@student/entities/student'
import type { StudentGateway } from '@student/gateways/student'
import type { CsvRemovalPreview } from '@student-shared'
import { parseStudentCsv } from '../importStudentsCsv/helpers/parseStudentCsv'
import { fingerprintRemoval } from '../importStudentsCsv/helpers/fingerprintRemoval'
import { planCsvRemoval } from '../importStudentsCsv/helpers/planCsvRemoval'

const previewSchema = z.object({ csv: z.string() })

const SAMPLE_SIZE = 20
const SORT_LOCALE = 'fr'

interface PreviewCsvRemovalDeps {
  gateway: StudentGateway
}

export async function previewCsvRemoval(
  deps: PreviewCsvRemovalDeps,
  // Untrusted IPC payload: validated at runtime below
  input: unknown
): Promise<UseCaseResult<CsvRemovalPreview>> {
  const payload = previewSchema.safeParse(input)
  if (!payload.success) {
    return { success: false, error: 'Invalid preview payload', code: ErrorCode.VALIDATION_ERROR }
  }

  let existing: StudentEntity[]
  try {
    existing = await deps.gateway.getAll()
  } catch {
    return { success: false, error: 'Failed to read students', code: ErrorCode.DATABASE_ERROR }
  }

  const { blockedReason, toRemove } = planCsvRemoval(existing, parseStudentCsv(payload.data.csv))
  const sample = [...toRemove]
    .sort(
      (a, b) =>
        a.nom.localeCompare(b.nom, SORT_LOCALE) || a.prenom.localeCompare(b.prenom, SORT_LOCALE)
    )
    .slice(0, SAMPLE_SIZE)
    .map((student) => `${student.prenom} ${student.nom}`)

  return {
    success: true,
    data: {
      toRemove: toRemove.length,
      total: existing.length,
      sample,
      fingerprint: fingerprintRemoval(toRemove),
      ...(blockedReason !== undefined && { blockedReason })
    }
  }
}
