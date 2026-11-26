import type { SQL } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, and, gte, lte, inArray, or, sql } from 'drizzle-orm'
import type {
  CheckedWriteOptions,
  CheckedWriteResult,
  FrequentationGateway
} from './frequentation.gateway'
import type {
  FrequentationEntity,
  FrequentationWithStudentEntity
} from '@frequentation/entities/frequentation'
import type { CreateFrequentationDto, UpdateFrequentationDto } from '@frequentation-shared'
import { UNKNOWN_CLASS_LABEL } from '@frequentation-shared'
import { frequentationTable } from '@frequentation/entities/frequentation'
import { mapFrequentationRow, mapFrequentationWithStudentRow } from './helpers/mapFrequentationRow'
import { studentTable } from '@shared/db/schema'
import { findDuplicateMatches } from './helpers/findDuplicateMatches'
import type { DuplicateCandidate, ExistingVisit } from './helpers/findDuplicateMatches'

type FrequentationDb = BetterSQLite3Database<Record<string, unknown>>
export type FrequentationTx = Parameters<Parameters<FrequentationDb['transaction']>[0]>[0]

const ISO_DATE_LENGTH = 10
const START_OF_DAY_SUFFIX = 'T00:00:00'
const END_OF_DAY_SUFFIX = 'T23:59:59'

export class FrequentationGatewayDrizzle implements FrequentationGateway {
  constructor(private db: FrequentationDb) {}

  private studentClassSnapshot(studentId: number): SQL<string | null> {
    return sql<string | null>`(SELECT classe FROM students WHERE id = ${studentId})`
  }

  private buildSelection() {
    return {
      id: frequentationTable.id,
      startsAt: frequentationTable.startsAt,
      activity: frequentationTable.activity,
      studentId: frequentationTable.studentId,
      studentNom: studentTable.nom,
      studentPrenom: studentTable.prenom,
      studentClasse: sql<string>`COALESCE(${frequentationTable.studentClasse}, ${studentTable.classe}, ${UNKNOWN_CLASS_LABEL})`,
      studentIne: studentTable.ine,
      createdAt: frequentationTable.createdAt,
      updatedAt: frequentationTable.updatedAt
    }
  }

  protected findExisting(
    tx: FrequentationTx,
    studentIds: number[],
    days: string[]
  ): ExistingVisit[] {
    if (studentIds.length === 0 || days.length === 0) {
      return []
    }
    const dayRanges = days.map((day) =>
      and(
        gte(frequentationTable.startsAt, `${day}${START_OF_DAY_SUFFIX}`),
        lte(frequentationTable.startsAt, `${day}${END_OF_DAY_SUFFIX}`)
      )
    )
    return tx
      .select({
        id: frequentationTable.id,
        studentId: frequentationTable.studentId,
        startsAt: frequentationTable.startsAt,
        activity: frequentationTable.activity
      })
      .from(frequentationTable)
      .where(and(inArray(frequentationTable.studentId, studentIds), or(...dayRanges)))
      .all()
  }

  // Check and write share one IMMEDIATE transaction: the write lock is taken before the
  // lookup, so nothing can slip in between. Synchronous only (no await) inside the callback.
  async createManyChecked(
    items: CreateFrequentationDto[],
    options: CheckedWriteOptions
  ): Promise<CheckedWriteResult<FrequentationEntity[]>> {
    return this.db.transaction(
      (tx): CheckedWriteResult<FrequentationEntity[]> => {
        if (!options.allowDuplicates) {
          const studentIds = [...new Set(items.map((item) => item.studentId))]
          const days = [...new Set(items.map((item) => item.startsAt.slice(0, ISO_DATE_LENGTH)))]
          const duplicates = findDuplicateMatches(items, this.findExisting(tx, studentIds, days))
          if (duplicates.length > 0) {
            return { duplicates }
          }
        }
        const now = new Date().toISOString()
        const written = items.map((dto) => {
          const row = tx
            .insert(frequentationTable)
            .values({
              startsAt: dto.startsAt,
              activity: dto.activity,
              studentId: dto.studentId,
              studentClasse: this.studentClassSnapshot(dto.studentId),
              createdAt: now,
              updatedAt: now
            })
            .returning()
            .get()
          return mapFrequentationRow(row)
        })
        return { written }
      },
      { behavior: 'immediate' }
    )
  }

  async updateChecked(
    id: number,
    dto: UpdateFrequentationDto,
    options: CheckedWriteOptions
  ): Promise<CheckedWriteResult<FrequentationEntity | null>> {
    return this.db.transaction(
      (tx): CheckedWriteResult<FrequentationEntity | null> => {
        const current = tx
          .select()
          .from(frequentationTable)
          .where(eq(frequentationTable.id, id))
          .get()
        if (!current) {
          return { written: null }
        }
        // An anonymized visit is never re-linked to a student
        const nextStudentId =
          current.studentId === null ? null : (dto.studentId ?? current.studentId)
        const nextStartsAt = dto.startsAt ?? current.startsAt
        const studentChanged = nextStudentId !== current.studentId
        const startsAtChanged = nextStartsAt !== current.startsAt
        if (
          !options.allowDuplicates &&
          nextStudentId !== null &&
          (studentChanged || startsAtChanged)
        ) {
          const candidate: DuplicateCandidate = { studentId: nextStudentId, startsAt: nextStartsAt }
          const duplicates = findDuplicateMatches(
            [candidate],
            this.findExisting(tx, [nextStudentId], [nextStartsAt.slice(0, ISO_DATE_LENGTH)]),
            id
          )
          if (duplicates.length > 0) {
            return { duplicates }
          }
        }
        const row = tx
          .update(frequentationTable)
          .set({
            ...(dto.startsAt !== undefined && { startsAt: dto.startsAt }),
            ...(dto.activity !== undefined && { activity: dto.activity }),
            ...(studentChanged &&
              nextStudentId !== null && {
                studentId: nextStudentId,
                studentClasse: this.studentClassSnapshot(nextStudentId)
              }),
            updatedAt: new Date().toISOString()
          })
          .where(eq(frequentationTable.id, id))
          .returning()
          .get()
        return { written: row ? mapFrequentationRow(row) : null }
      },
      { behavior: 'immediate' }
    )
  }

  async getWithStudentById(id: number): Promise<FrequentationWithStudentEntity | null> {
    const results = await this.db
      .select(this.buildSelection())
      .from(frequentationTable)
      .leftJoin(studentTable, eq(frequentationTable.studentId, studentTable.id))
      .where(eq(frequentationTable.id, id))
    const row = results[0]
    return row ? mapFrequentationWithStudentRow(row) : null
  }

  async create(dto: CreateFrequentationDto): Promise<FrequentationEntity> {
    const now = new Date().toISOString()
    const result = await this.db
      .insert(frequentationTable)
      .values({
        startsAt: dto.startsAt,
        activity: dto.activity,
        studentId: dto.studentId,
        studentClasse: this.studentClassSnapshot(dto.studentId),
        createdAt: now,
        updatedAt: now
      })
      .returning()

    const row = result[0]
    if (!row) {
      throw new Error('Failed to create frequentation')
    }

    return mapFrequentationRow(row)
  }

  async getById(id: number): Promise<FrequentationEntity | null> {
    const result = await this.db
      .select()
      .from(frequentationTable)
      .where(eq(frequentationTable.id, id))
    const row = result[0]
    if (!row) {
      return null
    }
    return mapFrequentationRow(row)
  }

  async getAll(): Promise<FrequentationWithStudentEntity[]> {
    const results = await this.db
      .select(this.buildSelection())
      .from(frequentationTable)
      .leftJoin(studentTable, eq(frequentationTable.studentId, studentTable.id))
      .orderBy(frequentationTable.startsAt)

    return results.map((row) => mapFrequentationWithStudentRow(row))
  }

  async getByStudentId(studentId: number): Promise<FrequentationWithStudentEntity[]> {
    const results = await this.db
      .select(this.buildSelection())
      .from(frequentationTable)
      .leftJoin(studentTable, eq(frequentationTable.studentId, studentTable.id))
      .where(eq(frequentationTable.studentId, studentId))

    return results.map((row) => mapFrequentationWithStudentRow(row))
  }

  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<FrequentationWithStudentEntity[]> {
    const startOfDay = startDate.length === ISO_DATE_LENGTH ? `${startDate}T00:00:00` : startDate
    const endOfDay = endDate.length === ISO_DATE_LENGTH ? `${endDate}T23:59:59` : endDate

    const results = await this.db
      .select(this.buildSelection())
      .from(frequentationTable)
      .leftJoin(studentTable, eq(frequentationTable.studentId, studentTable.id))
      .where(
        and(
          gte(frequentationTable.startsAt, startOfDay),
          lte(frequentationTable.startsAt, endOfDay)
        )
      )

    return results.map((row) => mapFrequentationWithStudentRow(row))
  }

  async update(id: number, dto: UpdateFrequentationDto): Promise<FrequentationEntity | null> {
    const existingFrequentation = await this.getById(id)
    if (!existingFrequentation) {
      return null
    }

    const now = new Date().toISOString()
    const reassignedStudentId =
      dto.studentId !== existingFrequentation.studentId ? dto.studentId : undefined
    await this.db
      .update(frequentationTable)
      .set({
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt }),
        ...(dto.activity !== undefined && { activity: dto.activity }),
        ...(dto.studentId !== undefined && { studentId: dto.studentId }),
        ...(reassignedStudentId !== undefined && {
          studentClasse: this.studentClassSnapshot(reassignedStudentId)
        }),
        updatedAt: now
      })
      .where(eq(frequentationTable.id, id))

    return this.getById(id)
  }

  async delete(id: number): Promise<boolean> {
    const existingFrequentation = await this.getById(id)
    if (!existingFrequentation) {
      return false
    }

    await this.db.delete(frequentationTable).where(eq(frequentationTable.id, id))
    return true
  }

  async deleteByStudentId(studentId: number): Promise<number> {
    const before = await this.count()
    await this.db.delete(frequentationTable).where(eq(frequentationTable.studentId, studentId))
    const after = await this.count()
    return before - after
  }

  async count(): Promise<number> {
    const results = await this.db.select({ id: frequentationTable.id }).from(frequentationTable)
    return results.length
  }
}
