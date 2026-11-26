import type { StudentEntity, StudentWithVisitCountEntity } from '@student/entities/student'
import type { CreateStudentDto, UpdateStudentDto } from '@student-shared'

export interface AnonymizeByIdsResult {
  anonymized: number
  deletedWithoutVisits: number
}

export interface StudentGateway {
  create(studentData: CreateStudentDto): Promise<StudentEntity>
  getById(id: number): Promise<StudentEntity | null>
  getAll(): Promise<StudentEntity[]>
  update(id: number, dto: UpdateStudentDto): Promise<StudentEntity | null>
  delete(id: number): Promise<boolean>
  getByIds(ids: number[]): Promise<StudentEntity[]>
  getAllWithVisitCount(classe?: string): Promise<StudentWithVisitCountEntity[]>
  countVisitsByStudentId(studentId: number): Promise<number>
  anonymizeByIds(ids: number[]): Promise<AnonymizeByIdsResult>
  checkpoint(): Promise<void>
  withTransaction<T>(work: () => Promise<T>): Promise<T>
}
