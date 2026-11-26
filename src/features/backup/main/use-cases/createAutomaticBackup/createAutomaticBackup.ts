import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { AutomaticBackupReason } from '@backup-shared'
import { buildAutomaticBackupName, RESTORE_REASON } from '../../helpers/backupFileName'
import { getBackupRuntime, runExclusive } from '../../runtime'
import { createBackup } from '../createBackup'
import { listAutomaticBackups, type AutomaticBackupFile } from '../listAutomaticBackups'

export const AUTOMATIC_BACKUP_MAX_AGE_DAYS = 30
export const AUTOMATIC_BACKUP_MAX_COUNT = 10
export const RESTORE_BACKUP_MAX_COUNT = 3

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

// Pruning is best effort: a stuck old file must never fail a backup that was written
function ignorePruneFailure(): void {
  return undefined
}

async function removeQuietly(path: string): Promise<void> {
  await rm(path, { force: true }).catch(ignorePruneFailure)
}

async function pruneAutomaticBackups(
  backupsDir: string,
  now: Date,
  keepPath: string
): Promise<void> {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - AUTOMATIC_BACKUP_MAX_AGE_DAYS)

  const all = await listAutomaticBackups(backupsDir)
  // Restore safety copies follow their own rule: no age limit, only the most recent are kept
  const restoreCopies = all.filter((backup) => backup.reason === RESTORE_REASON)
  for (const backup of restoreCopies.slice(RESTORE_BACKUP_MAX_COUNT)) {
    if (backup.path !== keepPath) {
      await removeQuietly(backup.path)
    }
  }

  const backups = all.filter((backup) => backup.reason !== RESTORE_REASON)
  const kept: AutomaticBackupFile[] = []
  for (const backup of backups) {
    if (backup.date < cutoff && backup.path !== keepPath) {
      await removeQuietly(backup.path)
    } else {
      kept.push(backup)
    }
  }

  // Future-dated files (clock skew) are left alone and never count towards the cap
  const counted = kept.filter((backup) => backup.date <= now || backup.path === keepPath)
  for (const backup of counted.slice(AUTOMATIC_BACKUP_MAX_COUNT)) {
    if (backup.path !== keepPath) {
      await removeQuietly(backup.path)
    }
  }
}

export function createAutomaticBackup(reason: AutomaticBackupReason): Promise<string> {
  return runExclusive(async () => {
    const runtime = getBackupRuntime()
    const now = runtime.now()

    await mkdir(runtime.backupsDir, { recursive: true })
    const path = pickFreshPath(runtime.backupsDir, now, reason)
    await createBackup(runtime.getSqlite(), path)
    await pruneAutomaticBackups(runtime.backupsDir, now, path).catch(ignorePruneFailure)
    return path
  })
}
