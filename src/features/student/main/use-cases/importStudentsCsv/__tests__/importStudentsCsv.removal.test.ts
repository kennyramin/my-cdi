import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrateTestDatabase } from '@shared/db/testing/migrateTestDatabase'
import { StudentGatewayDrizzle } from '@student/gateways/student'
import { ErrorCode } from '@lib/errors'
import { importStudentsCsv } from '../importStudentsCsv'

const HEADER = 'nom;prenom;classe;ine'
const TEN = 10
const ELEVEN = 11
const SEED_FIVE = 5

interface CountRow {
  total: number
}

interface NameRow {
  nom: string
}

describe('importStudentsCsv with removeAbsent', () => {
  let sqlite: Database.Database
  let gateway: StudentGatewayDrizzle
  let backup: ReturnType<typeof vi.fn<(reason: 'anonymization') => Promise<string>>>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    migrateTestDatabase(sqlite)
    gateway = new StudentGatewayDrizzle(drizzle(sqlite))
    backup = vi.fn<(reason: 'anonymization') => Promise<string>>().mockResolvedValue('/backup.db')
  })

  afterEach(() => {
    sqlite.close()
  })

  function seed(ine: string, nom = `Nom${ine}`, visits = 1): number {
    const now = new Date().toISOString()
    const id = Number(
      sqlite
        .prepare(
          'INSERT INTO students (nom, prenom, classe, ine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(nom, 'Prenom', '3B', ine, now, now).lastInsertRowid
    )
    for (let index = 0; index < visits; index += 1) {
      sqlite
        .prepare(
          'INSERT INTO frequentation (starts_at, activity, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run('2026-03-02T10:15:00', 'reading', id, now, now)
    }
    return id
  }

  function count(table: string, where = '1=1'): number {
    return (
      sqlite.prepare<[], CountRow>(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`).get()
        ?.total ?? 0
    )
  }

  function run(csv: string, extra: { removeAbsent?: boolean; removalConfirmation?: string } = {}) {
    return importStudentsCsv({ gateway, createAutomaticBackup: backup }, { csv, ...extra })
  }

  const fileKeeping = (...ines: string[]): string =>
    [HEADER, ...ines.map((ine) => `Nom${ine};Prenom;3B;${ine}`)].join('\n')

  it('removeAbsent false never removes', async () => {
    seed('A')
    seed('B')
    await run(fileKeeping('A'))
    expect(count('students')).toBe(2)
    expect(backup).not.toHaveBeenCalled()
  })

  it('removes absent students and keeps their visits anonymized', async () => {
    seed('A')
    seed('B', 'Gone', 2)
    const result = await run(fileKeeping('A'), { removeAbsent: true })
    expect(result.success).toBe(true)
    expect(count('students')).toBe(1)
    expect(count('frequentation')).toBe(3)
    expect(count('frequentation', "student_id IS NULL AND student_classe = '3B'")).toBe(2)
  })

  it('result reports anonymized and deletedWithoutVisits', async () => {
    seed('A')
    seed('B', 'WithVisits', 1)
    seed('C', 'Without', 0)
    const result = await run(fileKeeping('A'), {
      removeAbsent: true,
      removalConfirmation: 'RETIRER 2'
    })
    expect(result.success && result.data.anonymized).toBe(1)
    expect(result.success && result.data.deletedWithoutVisits).toBe(1)
  })

  it('refused when file has row errors', async () => {
    seed('A')
    seed('B')
    const result = await run(`${fileKeeping('A')}\n;X;3B;ZZ`, { removeAbsent: true })
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(count('students')).toBe(2)
    expect(backup).not.toHaveBeenCalled()
  })

  it('refused for an empty file', async () => {
    seed('A')
    const result = await run(HEADER, { removeAbsent: true })
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(count('students')).toBe(1)
    expect(backup).not.toHaveBeenCalled()
  })

  it('threshold: 10 absent without typed confirmation is refused server-side, nothing written, no backup', async () => {
    for (let index = 0; index <= TEN; index += 1) {
      seed(`S${index}`)
    }
    const result = await run(fileKeeping('S0', 'NEW'), { removeAbsent: true })
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(count('students')).toBe(ELEVEN)
    expect(count('students', "ine = 'NEW'")).toBe(0)
    expect(backup).not.toHaveBeenCalled()
  })

  it('10 absent with RETIRER 10 proceeds', async () => {
    for (let index = 0; index <= TEN; index += 1) {
      seed(`S${index}`)
    }
    const result = await run(fileKeeping('S0'), {
      removeAbsent: true,
      removalConfirmation: 'RETIRER 10'
    })
    expect(result.success).toBe(true)
    expect(count('students')).toBe(1)
  })

  it('>50% requires confirmation even below 10', async () => {
    for (let index = 0; index < SEED_FIVE; index += 1) {
      seed(`S${index}`)
    }
    const refused = await run(fileKeeping('S0', 'S1'), { removeAbsent: true })
    expect(refused).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(count('students')).toBe(SEED_FIVE)
    const accepted = await run(fileKeeping('S0', 'S1'), {
      removeAbsent: true,
      removalConfirmation: 'RETIRER 3'
    })
    expect(accepted.success).toBe(true)
    expect(count('students')).toBe(2)
  })

  it('wrong count in confirmation (RETIRER 9 for 10) refused', async () => {
    for (let index = 0; index <= TEN; index += 1) {
      seed(`S${index}`)
    }
    const result = await run(fileKeeping('S0'), {
      removeAbsent: true,
      removalConfirmation: 'RETIRER 9'
    })
    expect(result).toMatchObject({ success: false, code: ErrorCode.VALIDATION_ERROR })
    expect(count('students')).toBe(ELEVEN)
  })

  it("backup taken with 'anonymization' before the transaction, only when toRemove > 0", async () => {
    seed('A')
    seed('B')
    const order: string[] = []
    backup.mockImplementation(() => {
      order.push(sqlite.inTransaction ? 'backup-in-tx' : 'backup')
      return Promise.resolve('/backup.db')
    })
    await run(fileKeeping('A', 'B'), { removeAbsent: true })
    expect(backup).not.toHaveBeenCalled()
    await run(fileKeeping('A'), { removeAbsent: true })
    expect(backup).toHaveBeenCalledWith('anonymization')
    expect(order).toEqual(['backup'])
  })

  it('backup failure aborts with BACKUP_WRITE_FAILED, nothing changed', async () => {
    seed('A')
    seed('B')
    backup.mockRejectedValue(new Error('disk full'))
    const result = await run(`${HEADER}\nRenamed;Prenom;3B;A\nNew;Prenom;3B;C`, {
      removeAbsent: true
    })
    expect(result).toMatchObject({ success: false, code: ErrorCode.BACKUP_WRITE_FAILED })
    expect(count('students')).toBe(2)
    expect(count('students', "nom = 'Renamed' OR ine = 'C'")).toBe(0)
  })

  it('student present in the file is never removed even if its update fails', async () => {
    seed('A')
    seed('B')
    sqlite.exec(
      `CREATE TRIGGER boom BEFORE UPDATE ON students WHEN NEW.nom = 'Boom' BEGIN SELECT RAISE(ABORT, 'boom'); END`
    )
    const result = await run(`${HEADER}\nBoom;Prenom;3B;A`, { removeAbsent: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.errorDetails.map((error) => error.type)).toEqual(['DATABASE_ERROR'])
    }
    expect(count('students', "ine = 'A'")).toBe(1)
    expect(count('students', "ine = 'B'")).toBe(0)
  })

  it('import and removal share one transaction: a failing removal rolls back created and updated rows', async () => {
    seed('A', 'Before')
    seed('C', 'Absent')
    sqlite.exec(
      `CREATE TRIGGER nodelete BEFORE DELETE ON students BEGIN SELECT RAISE(ABORT, 'no'); END`
    )
    const result = await run(`${HEADER}\nAfter;Prenom;3B;A\nFresh;Prenom;3B;NEW`, {
      removeAbsent: true
    })
    expect(result).toMatchObject({ success: false, code: ErrorCode.DATABASE_ERROR })
    expect(count('students')).toBe(2)
    expect(count('students', "ine = 'NEW'")).toBe(0)
    const row = sqlite.prepare<[], NameRow>("SELECT nom FROM students WHERE ine = 'A'").get()
    expect(row?.nom).toBe('Before')
    expect(count('frequentation', 'student_id IS NULL')).toBe(0)
    expect(sqlite.inTransaction).toBe(false)
  })

  it('duplicate policy is forced to replace', async () => {
    seed('A', 'Before')
    seed('B')
    const result = await importStudentsCsv(
      { gateway, createAutomaticBackup: backup },
      {
        csv: `${HEADER}\nAfter;Prenom;3B;A\nNom;Prenom;3B;B`,
        removeAbsent: true,
        onDuplicateIne: 'skip'
      }
    )
    expect(result.success && result.data.updated).toBe(2)
    expect(count('students', "nom = 'After'")).toBe(1)
  })

  it('INE case/space differences update instead of creating a duplicate', async () => {
    seed(' ab12 ', 'Before')
    const result = await run(`${HEADER}\nAfter;Prenom;3B;AB12`, { removeAbsent: true })
    expect(result.success && result.data.updated).toBe(1)
    expect(result.success && result.data.created).toBe(0)
    expect(count('students')).toBe(1)
  })
})
