import { rm } from 'node:fs/promises'
import { listAutomaticBackups } from '../listAutomaticBackups'

export async function deleteAutomaticBackups(backupsDir: string): Promise<{ deleted: number }> {
  const backups = await listAutomaticBackups(backupsDir)
  let deleted = 0
  for (const backup of backups) {
    // Best effort: a file that cannot be removed is skipped and not counted
    const removed = await rm(backup.path).then(
      () => true,
      () => false
    )
    if (removed) {
      deleted += 1
    }
  }
  return { deleted }
}
