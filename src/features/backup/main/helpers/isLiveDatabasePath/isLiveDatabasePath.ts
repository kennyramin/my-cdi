import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const WAL_SUFFIX = '-wal'
const SHM_SUFFIX = '-shm'

function canonicalPath(path: string): string {
  const absolute = resolve(path)
  if (existsSync(absolute)) {
    return realpathSync.native(absolute)
  }
  const parent = dirname(absolute)
  if (existsSync(parent)) {
    return join(realpathSync.native(parent), basename(absolute))
  }
  return absolute
}

function isSameFile(a: string, b: string): boolean {
  if (canonicalPath(a) === canonicalPath(b)) {
    return true
  }
  if (!existsSync(a) || !existsSync(b)) {
    return false
  }
  const statA = statSync(a)
  const statB = statSync(b)
  return statA.dev === statB.dev && statA.ino === statB.ino
}

export function isLiveDatabasePath(livePath: string, destinationPath: string): boolean {
  return [livePath, `${livePath}${WAL_SUFFIX}`, `${livePath}${SHM_SUFFIX}`].some((candidate) =>
    isSameFile(candidate, destinationPath)
  )
}
