import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseAutomaticBackupName } from '../../helpers/backupFileName'

export interface AutomaticBackupFile {
  name: string
  path: string
  date: Date
}

const MISSING_FOLDER_CODE = 'ENOENT'

function isMissingFolder(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING_FOLDER_CODE
}

export async function listAutomaticBackups(backupsDir: string): Promise<AutomaticBackupFile[]> {
  const entries = await readdir(backupsDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingFolder(error)) {
      return []
    }
    throw error
  })

  const files: AutomaticBackupFile[] = []
  for (const entry of entries) {
    const parsed = entry.isFile() ? parseAutomaticBackupName(entry.name) : null
    if (parsed) {
      files.push({ name: entry.name, path: join(backupsDir, entry.name), date: parsed.date })
    }
  }
  return files.sort((a, b) => b.date.getTime() - a.date.getTime())
}
