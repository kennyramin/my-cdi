import { describe, it, expect } from 'vitest'
import { parseStudentCsv } from '../parseStudentCsv'

const EXPECTED_TWO_ROWS = 2
const EXPECTED_ONE_ROW = 1
const FIRST_INDEX = 0
const EXPECTED_ZERO_ERRORS = 0
const EXPECTED_TWO_ERRORS = 2

describe('parseStudentCsv', () => {
  it('parses a valid CSV string', () => {
    const csv = `nom;prenom;classe;ine
Dupont;Jean;3B;INE1
Martin;Pierre;3A;INE2`
    const result = parseStudentCsv(csv)
    expect(result.data).toHaveLength(EXPECTED_TWO_ROWS)
    expect(result.errors).toHaveLength(EXPECTED_ZERO_ERRORS)
    expect(result.data[FIRST_INDEX]?.nom).toBe('Dupont')
  })

  it('returns error for missing required columns', () => {
    const csv = `nom;prenom
Dupont;Jean`
    const result = parseStudentCsv(csv)
    expect(result.data).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[FIRST_INDEX]?.type).toBe('MISSING_COLUMNS')
  })

  it('skips rows that fail validation and collects errors', () => {
    const csv = `nom;prenom;classe;ine
Dupont;Jean;3B;INE1
; Pierre;3A;INE2
Martin; ;3B;INE3`
    const result = parseStudentCsv(csv)
    expect(result.data).toHaveLength(EXPECTED_ONE_ROW)
    expect(result.errors).toHaveLength(EXPECTED_TWO_ERRORS)
    expect(result.errors[0]?.type).toBe('ROW_VALIDATION')
    expect(result.data[FIRST_INDEX]?.nom).toBe('Dupont')
  })

  it('maps real-world French headers and semicolon delimiter', () => {
    const csv = `Nom de famille;Prénom 1;Date de naissance;INE;Division;Ligne 3 Adresse financ.;Commune resp. financ.
INDRATH;Sylvie;29/09/2010;130170846FA;2NDE A;14 RUE EPHEOTUS;CHELLES`
    const result = parseStudentCsv(csv)
    expect(result.data).toHaveLength(EXPECTED_ONE_ROW)
    expect(result.errors).toHaveLength(EXPECTED_ZERO_ERRORS)
    expect(result.data[FIRST_INDEX]?.nom).toBe('INDRATH')
    expect(result.data[FIRST_INDEX]?.prenom).toBe('Sylvie')
    expect(result.data[FIRST_INDEX]?.classe).toBe('2NDE A')
    expect(result.data[FIRST_INDEX]?.ine).toBe('130170846FA')
  })

  it('auto-detects comma delimiter', () => {
    const csv = `nom,prenom,classe,ine
Dupont,Jean,3B,INE1`
    const result = parseStudentCsv(csv)
    expect(result.data).toHaveLength(EXPECTED_ONE_ROW)
    expect(result.errors).toHaveLength(EXPECTED_ZERO_ERRORS)
    expect(result.data[FIRST_INDEX]?.nom).toBe('Dupont')
  })

  it('reports an unterminated quote with its physical line, blank lines included', () => {
    const csv = `nom;prenom;classe;ine

Dupont;Jean;3B;INE1


"Martin;Pierre;3A;INE2`
    const result = parseStudentCsv(csv)
    expect(result.errors).toContainEqual({
      type: 'ROW_VALIDATION',
      rowNumber: 6,
      issues: [{ field: 'csv', code: 'invalid_quotes' }]
    })
    expect(result.errors).toHaveLength(1)
  })

  it('treats a row with an extra delimiter as an error and does not import it', () => {
    const csv = `nom;prenom;classe;ine
A;B;3B;I1
Dup;ont;Jean;3B;I2
C;D;3B;I3`
    const result = parseStudentCsv(csv)
    expect(result.errors).toEqual([
      {
        type: 'ROW_VALIDATION',
        rowNumber: 3,
        issues: [{ field: 'csv', code: 'invalid_field_count' }]
      }
    ])
    expect(result.data.map((row) => row.ine)).toEqual(['I1', 'I3'])
  })

  it('treats a row with a missing field as an error', () => {
    const csv = `nom;prenom;classe;ine
A;B;3B
C;D;3B;I3`
    const result = parseStudentCsv(csv)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ type: 'ROW_VALIDATION', rowNumber: 2 })
    expect(result.data).toHaveLength(1)
  })

  it('reports validation errors with the physical line when blank lines are skipped', () => {
    const csv = `nom;prenom;classe;ine

A;B;3B;I1

;X;3B;I2`
    const result = parseStudentCsv(csv)
    expect(result.errors[0]).toMatchObject({ type: 'ROW_VALIDATION', rowNumber: 5 })
  })
})
