import type { AutomaticBackupReason } from '@backup-shared'

export type CreateBackup = (destinationPath: string) => Promise<void>

export type CreateAutomaticBackup = (reason: AutomaticBackupReason) => Promise<string>
