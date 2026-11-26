import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import { backupKeys } from '../backupKeys'

export function useDeleteAutomaticBackups() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')
  return useMutation({
    mutationFn: async () => {
      const result = await window.electronAPI.backup.deleteAutomatic()
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: backupKeys.all })
    }
  })
}
