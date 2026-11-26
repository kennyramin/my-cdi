import type {
  FrequentationEntity,
  FrequentationWithStudentEntity
} from '@frequentation/entities/frequentation'
import type { CreateFrequentationDto, UpdateFrequentationDto } from '@frequentation-shared'
import type { ActivityType } from '@types'

export interface DuplicateMatch {
  studentId: number
  existingId: number
  existingStartsAt: string
  existingActivity: ActivityType
}

export type CheckedWriteResult<T> = { duplicates: DuplicateMatch[] } | { written: T }

export interface CheckedWriteOptions {
  allowDuplicates: boolean
}

export interface FrequentationGateway {
  create(frequentationData: CreateFrequentationDto): Promise<FrequentationEntity>
  createManyChecked(
    items: CreateFrequentationDto[],
    options: CheckedWriteOptions
  ): Promise<CheckedWriteResult<FrequentationEntity[]>>
  updateChecked(
    id: number,
    dto: UpdateFrequentationDto,
    options: CheckedWriteOptions
  ): Promise<CheckedWriteResult<FrequentationEntity | null>>
  getById(id: number): Promise<FrequentationEntity | null>
  getWithStudentById(id: number): Promise<FrequentationWithStudentEntity | null>
  getAll(): Promise<FrequentationWithStudentEntity[]>
  getByStudentId(studentId: number): Promise<FrequentationWithStudentEntity[]>
  getByDateRange(startDate: string, endDate: string): Promise<FrequentationWithStudentEntity[]>
  update(id: number, dto: UpdateFrequentationDto): Promise<FrequentationEntity | null>
  delete(id: number): Promise<boolean>
  deleteByStudentId(studentId: number): Promise<number>
  count(): Promise<number>
}
