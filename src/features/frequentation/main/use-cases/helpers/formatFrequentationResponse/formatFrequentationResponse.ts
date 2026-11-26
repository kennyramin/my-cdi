import type { FrequentationWithStudentEntity } from '@frequentation/entities/frequentation'
import { ANONYMIZED_STUDENT_LABEL } from '@frequentation-shared'
import type { FrequentationResponseDto } from '@frequentation-shared'

export function formatFrequentationResponse(
  entity: FrequentationWithStudentEntity
): FrequentationResponseDto {
  return {
    id: entity.id,
    startsAt: entity.startsAt,
    activity: entity.activity,
    studentId: entity.studentId,
    studentName:
      entity.studentPrenom === null || entity.studentNom === null
        ? ANONYMIZED_STUDENT_LABEL
        : `${entity.studentPrenom} ${entity.studentNom}`,
    studentClass: entity.studentClasse,
    studentIne: entity.studentIne ?? '',
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  }
}
