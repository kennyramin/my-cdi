import { rm } from 'node:fs/promises'
import { listAutomaticBackups } from '../listAutomaticBackups'

export async function deleteAutomaticBackups(backupsDir: string): Promise<{ deleted: number }> {
  const backups = await listAutomaticBackups(backupsDir)
  for (const backup of backups) {
    await rm(backup.path, { force: true })
  }
  return { deleted: backups.length }
}
