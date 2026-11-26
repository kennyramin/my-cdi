import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import { backupKeys } from '../backupKeys'
import type { BackupStatusDto } from '@backup-shared'

export function useBackupStatus() {
  const { t } = useTranslation('common')
  return useQuery({
    queryKey: [...backupKeys.status()],
    queryFn: async (): Promise<BackupStatusDto> => {
      const result = await window.electronAPI.backup.getStatus()
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    }
  })
}
