import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveIpcErrorMessage } from '@lib/ipc/resolveIpcErrorMessage'
import type { ExportRequestDto, ExportResultDto } from '@export-shared'

export function useExportMutation() {
  const { t } = useTranslation('common')
  return useMutation<ExportResultDto, Error, ExportRequestDto>({
    mutationFn: async (request) => {
      const result = await window.electronAPI.export.run(request)
      if (!result.success) {
        throw new Error(resolveIpcErrorMessage(result, t))
      }
      return result.data
    }
  })
}
