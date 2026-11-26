import { count, eq, getTableColumns, inArray } from 'drizzle-orm'
import type Database from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnonymizeByIdsResult, StudentGateway } from './student.gateway'
import type { StudentEntity, StudentWithVisitCountEntity } from '@student/entities/student'
import { studentTable } from '@student/entities/student'
import { frequentationTable } from '@frequentation/entities/frequentation'
import type { CreateStudentDto, UpdateStudentDto } from '@student-shared'
import { mapStudentRow } from './helpers/mapStudentRow'

export type StudentDb = BetterSQLite3Database<Record<string, unknown>> & {
  $client: Database.Database
}

const NO_VISITS = 0
const ANONYMIZE_CHUNK_SIZE = 500

interface CountRow {
  total: number
}

function chunkIds(ids: number[]): number[][] {
  const chunks: number[][] = []
  for (let start = 0; start < ids.length; start += ANONYMIZE_CHUNK_SIZE) {
    chunks.push(ids.slice(start, start + ANONYMIZE_CHUNK_SIZE))
  }
  return chunks
}

// A failed ROLLBACK must never mask the original error
function rollbackQuietly(sqlite: Database.Database): void {
  try {
    sqlite.exec('ROLLBACK')
  } catch {
    // nothing left to roll back (e.g. SQLite already rolled the transaction back)
  }
}

function placeholders(ids: number[]): string {
  return ids.map(() => '?').join(', ')
}

export class StudentGatewayDrizzle implements StudentGateway {
  constructor(private db: StudentDb) {}

  async create(studentData: CreateStudentDto): Promise<StudentEntity> {
    const now = new Date().toISOString()
    const result = await this.db
      .insert(studentTable)
      .values({
        nom: studentData.nom,
        prenom: studentData.prenom,
        classe: studentData.classe,
        ine: studentData.ine,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    const inserted = result[0]
    if (!inserted) {
      throw new Error('Failed to create student')
    }
    return mapStudentRow(inserted)
  }

  async getById(id: number): Promise<StudentEntity | null> {
    const result = await this.db.select().from(studentTable).where(eq(studentTable.id, id))
    const row = result[0]
    if (!row) {
      return null
    }
    return mapStudentRow(row)
  }

  async getAll(): Promise<StudentEntity[]> {
    const rows = await this.db.select().from(studentTable)
    return rows.map(mapStudentRow)
  }

  async update(id: number, dto: UpdateStudentDto): Promise<StudentEntity | null> {
    const existingStudent = await this.getById(id)
    if (!existingStudent) {
      return null
    }

    const now = new Date().toISOString()
    await this.db
      .update(studentTable)
      .set({
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.prenom !== undefined && { prenom: dto.prenom }),
        ...(dto.classe !== undefined && { classe: dto.classe }),
        ...(dto.ine !== undefined && { ine: dto.ine }),
        updatedAt: now
      })
      .where(eq(studentTable.id, id))

    return this.getById(id)
  }

  async delete(id: number): Promise<boolean> {
    const existingStudent = await this.getById(id)
    if (!existingStudent) {
      return false
    }
    await this.db.delete(studentTable).where(eq(studentTable.id, id))
    return true
  }

  async getByIds(ids: number[]): Promise<StudentEntity[]> {
    if (ids.length === 0) {
      return []
    }
    const students: StudentEntity[] = []
    for (const chunk of chunkIds(ids)) {
      const rows = await this.db.select().from(studentTable).where(inArray(studentTable.id, chunk))
      students.push(...rows.map(mapStudentRow))
    }
    return students
  }

  async getAllWithVisitCount(classe?: string): Promise<StudentWithVisitCountEntity[]> {
    const rows = await this.db
      .select({ ...getTableColumns(studentTable), visitCount: count(frequentationTable.id) })
      .from(studentTable)
      .leftJoin(frequentationTable, eq(frequentationTable.studentId, studentTable.id))
      .where(classe === undefined ? undefined : eq(studentTable.classe, classe))
      .groupBy(studentTable.id)
    return rows.map(({ visitCount, ...student }) => ({ ...mapStudentRow(student), visitCount }))
  }

  async countVisitsByStudentId(studentId: number): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(frequentationTable)
      .where(eq(frequentationTable.studentId, studentId))
    return rows[0]?.value ?? NO_VISITS
  }

  async anonymizeByIds(ids: number[]): Promise<AnonymizeByIdsResult> {
    const sqlite = this.db.$client
    const run = sqlite.transaction((): AnonymizeByIdsResult => {
      let existing = 0
      let withVisits = 0
      for (const chunk of chunkIds(ids)) {
        const marks = placeholders(chunk)
        sqlite
          .prepare(
            `UPDATE frequentation SET student_classe = (SELECT classe FROM students WHERE id = frequentation.student_id) WHERE student_id IN (${marks}) AND student_classe IS NULL`
          )
          .run(...chunk)
        const existingRow = sqlite
          .prepare<number[], CountRow>(
            `SELECT COUNT(*) AS total FROM students WHERE id IN (${marks})`
          )
          .get(...chunk)
        const withVisitsRow = sqlite
          .prepare<number[], CountRow>(
            `SELECT COUNT(*) AS total FROM students WHERE id IN (${marks}) AND EXISTS (SELECT 1 FROM frequentation WHERE frequentation.student_id = students.id)`
          )
          .get(...chunk)
        existing += existingRow?.total ?? NO_VISITS
        withVisits += withVisitsRow?.total ?? NO_VISITS
        sqlite
          .prepare(`UPDATE frequentation SET student_id = NULL WHERE student_id IN (${marks})`)
          .run(...chunk)
        sqlite.prepare(`DELETE FROM students WHERE id IN (${marks})`).run(...chunk)
      }
      return { anonymized: withVisits, deletedWithoutVisits: existing - withVisits }
    })
    return run()
  }

  // `work` must only await synchronous-backed gateway calls (no real I/O), so no other
  // statement can interleave on this connection while the transaction is open
  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    const sqlite = this.db.$client
    sqlite.exec('BEGIN IMMEDIATE')
    try {
      const result = await work()
      sqlite.exec('COMMIT')
      return result
    } catch (error) {
      rollbackQuietly(sqlite)
      throw error
    }
  }

  // Flushes the WAL into the main file so zeroed (secure_delete) pages replace the old images.
  // Must run outside any transaction, after the commit. Best effort: the data change is
  // already committed, so a busy checkpoint must not turn it into a reported failure.
  async checkpoint(): Promise<void> {
    try {
      this.db.$client.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      // the next checkpoint (or app close) flushes it
    }
  }
}
