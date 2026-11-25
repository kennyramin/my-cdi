import { formatStudentResponse } from '../helpers/formatStudentResponse'
import type { UseCaseResult } from '@lib/use-case'
import type { StudentGateway } from '@student/gateways/student'
import type { StudentListResponseDto } from '@student-shared'

interface ListStudentsDeps {
  gateway: StudentGateway
}

interface ListStudentsInput {
  classe?: string
}

export async function listStudents(
  deps: ListStudentsDeps,
  input: ListStudentsInput
): Promise<UseCaseResult<StudentListResponseDto>> {
  const rows = await deps.gateway.getAllWithVisitCount(input.classe)

  const students = rows.map((row) => formatStudentResponse(row, row.visitCount))

  return { success: true, data: { students } }
}
