import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { AutomaticBackupReason } from '@backup-shared'
import { buildAutomaticBackupName } from '../../helpers/backupFileName'
import { getBackupRuntime } from '../../runtime'
import { createBackup } from '../createBackup'
import { listAutomaticBackups, type AutomaticBackupFile } from '../listAutomaticBackups'

export const AUTOMATIC_BACKUP_MAX_AGE_DAYS = 30
export const AUTOMATIC_BACKUP_MAX_COUNT = 10

const MS_PER_SECOND = 1000

function pickFreshPath(backupsDir: string, now: Date, reason: AutomaticBackupReason): string {
  let stamp = now
  let path = join(backupsDir, buildAutomaticBackupName(stamp, reason))
  while (existsSync(path)) {
    stamp = new Date(stamp.getTime() + MS_PER_SECOND)
    path = join(backupsDir, buildAutomaticBackupName(stamp, reason))
  }
  return path
}

async function pruneAutomaticBackups(
  backupsDir: string,
  now: Date,
  keepPath: string
): Promise<void> {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - AUTOMATIC_BACKUP_MAX_AGE_DAYS)

  const backups = await listAutomaticBackups(backupsDir)
  const recent: AutomaticBackupFile[] = []
  for (const backup of backups) {
    if (backup.date < cutoff && backup.path !== keepPath) {
      await rm(backup.path, { force: true })
    } else {
      recent.push(backup)
    }
  }

  for (const backup of recent.slice(AUTOMATIC_BACKUP_MAX_COUNT)) {
    if (backup.path !== keepPath) {
      await rm(backup.path, { force: true })
    }
  }
}

export async function createAutomaticBackup(reason: AutomaticBackupReason): Promise<string> {
  const runtime = getBackupRuntime()
  const now = runtime.now()

  await mkdir(runtime.backupsDir, { recursive: true })
  const path = pickFreshPath(runtime.backupsDir, now, reason)
  await createBackup(runtime.getSqlite(), path)
  await pruneAutomaticBackups(runtime.backupsDir, now, path)
  return path
}
