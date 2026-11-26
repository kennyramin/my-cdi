import type { AutomaticBackupReason } from '@backup-shared'

export type CreateBackup = (destinationPath: string) => Promise<void>

export type CreateAutomaticBackup = (reason: AutomaticBackupReason) => Promise<string>

export interface AppLifecycle {
  relaunch(): void
}

export interface FileOps {
  copyFile(src: string, dest: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  rm(path: string, options?: { force?: boolean }): Promise<void>
}
