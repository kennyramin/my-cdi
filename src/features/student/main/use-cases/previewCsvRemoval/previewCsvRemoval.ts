import { ErrorCode } from '@lib/errors'
import type { UseCaseResult } from '@lib/use-case'
import type { StudentEntity } from '@student/entities/student'
import type { StudentGateway } from '@student/gateways/student'
import type { CsvRemovalPreview, PreviewCsvRemovalPayload } from '@student-shared'
import { parseStudentCsv } from '../importStudentsCsv/helpers/parseStudentCsv'
import { planCsvRemoval } from '../importStudentsCsv/helpers/planCsvRemoval'

const SAMPLE_SIZE = 20
const SORT_LOCALE = 'fr'

interface PreviewCsvRemovalDeps {
  gateway: StudentGateway
}

export async function previewCsvRemoval(
  deps: PreviewCsvRemovalDeps,
  input: PreviewCsvRemovalPayload
): Promise<UseCaseResult<CsvRemovalPreview>> {
  let existing: StudentEntity[]
  try {
    existing = await deps.gateway.getAll()
  } catch {
    return { success: false, error: 'Failed to read students', code: ErrorCode.DATABASE_ERROR }
  }

  const { blockedReason, toRemove } = planCsvRemoval(existing, parseStudentCsv(input.csv))
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
      ...(blockedReason !== undefined && { blockedReason })
    }
  }
}
