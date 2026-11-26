import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import type { RestoreInput } from '@backup-shared'

export function useRestoreBackup() {
  const { t } = useTranslation('common')
  return useMutation({
    mutationFn: async (input: RestoreInput) => {
      const result = await window.electronAPI.backup.restore(input)
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    }
  })
}
