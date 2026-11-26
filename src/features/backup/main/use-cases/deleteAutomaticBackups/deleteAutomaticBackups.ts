import { rm } from 'node:fs/promises'
import { RESTORE_REASON } from '../../helpers/backupFileName'
import { listAutomaticBackups } from '../listAutomaticBackups'

export async function deleteAutomaticBackups(backupsDir: string): Promise<{ deleted: number }> {
  const backups = await listAutomaticBackups(backupsDir)
  let deleted = 0
  for (const backup of backups) {
    // Restore safety copies are the last resort after a bad restore: never swept with the rest
    if (backup.reason === RESTORE_REASON) {
      continue
    }
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
