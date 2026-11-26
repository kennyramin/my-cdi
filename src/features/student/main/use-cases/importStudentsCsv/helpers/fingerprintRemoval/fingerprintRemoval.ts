import { createHash } from 'node:crypto'
import type { StudentEntity } from '@student/entities/student'
import { normalizeIne } from '../normalizeIne'

const HASH_ALGORITHM = 'sha256'
const INE_SEPARATOR = '\n'

export function fingerprintRemoval(toRemove: StudentEntity[]): string {
  const ines = toRemove.map((student) => normalizeIne(student.ine)).sort()
  return createHash(HASH_ALGORITHM).update(ines.join(INE_SEPARATOR)).digest('hex')
}
