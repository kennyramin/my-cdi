import type { DuplicateMatch } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { DuplicateWarningDto } from '@frequentation-shared'

function dedupeByExistingId(matches: DuplicateMatch[]): DuplicateMatch[] {
  const seen = new Set<number>()
  return matches.filter((match) => {
    if (seen.has(match.existingId)) {
      return false
    }
    seen.add(match.existingId)
    return true
  })
}

export async function buildDuplicateWarnings(
  studentGateway: StudentGateway,
  duplicates: DuplicateMatch[]
): Promise<DuplicateWarningDto[]> {
  const matches = dedupeByExistingId(duplicates)
  const students = await studentGateway.getByIds([
    ...new Set(matches.map((match) => match.studentId))
  ])
  const namesById = new Map(
    students.map((student) => [student.id, `${student.prenom} ${student.nom}`])
  )
  return matches.map((match) => ({
    studentId: match.studentId,
    studentName: namesById.get(match.studentId) ?? ANONYMIZED_STUDENT_LABEL,
    existingStartsAt: match.existingStartsAt,
    existingActivity: match.existingActivity
  }))
}
