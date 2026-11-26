import { describe, expect, it } from 'vitest'
import { ensureDbExtension } from '../ensureDbExtension'

describe('ensureDbExtension', () => {
  it('appends .db when missing', () => {
    expect(ensureDbExtension('/a/sauvegarde')).toBe('/a/sauvegarde.db')
  })

  it('keeps an existing .db extension, whatever its case', () => {
    expect(ensureDbExtension('/a/x.db')).toBe('/a/x.db')
    expect(ensureDbExtension('/a/x.DB')).toBe('/a/x.DB')
  })

  it('appends .db after another extension', () => {
    expect(ensureDbExtension('/a/x.backup')).toBe('/a/x.backup.db')
  })
})
