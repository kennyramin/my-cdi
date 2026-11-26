import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@ui/hooks/useToast'
import { useBackupStatus } from '@backup/api/useBackupStatus'
import { useCreateBackup } from '@backup/api/useCreateBackup'
import { useRestoreBackup } from '@backup/api/useRestoreBackup'
import { useDeleteAutomaticBackups } from '@backup/api/useDeleteAutomaticBackups'
import { getBackupStatusView } from '@backup/helpers/getBackupStatusView'

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useDataCard() {
  const { t } = useTranslation('common')
  const { toast, show, dismiss } = useToast()
  const status = useBackupStatus()
  const createBackup = useCreateBackup()
  const restoreBackup = useRestoreBackup()
  const deleteAutomatic = useDeleteAutomaticBackups()
  const [restoreFileName, setRestoreFileName] = useState('')
  const [isRestoreOpen, setIsRestoreOpen] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const isLoading = status.isPending
  const isError = status.isError
  const isReady = status.isSuccess
  const statusView = getBackupStatusView(status.data?.lastBackupAt ?? null, new Date())
  const isWarning = isReady && (statusView.kind === 'never' || statusView.isWarning)
  const automaticCount = status.data?.automaticCount ?? 0
  const isBusy =
    createBackup.isPending ||
    restoreBackup.isPending ||
    deleteAutomatic.isPending ||
    isRestarting ||
    !isReady

  function resolveStatusText(): string {
    if (isLoading) {
      return t('settings.data.status.loading')
    }
    if (isError) {
      return errorMessageOf(status.error, t('errors.generic'))
    }
    if (statusView.kind === 'never') {
      return t('settings.data.status.never')
    }
    if (statusView.days === 0) {
      return t('settings.data.status.today')
    }
    return t('settings.data.status.days', { count: statusView.days })
  }

  async function runAndToast(action: () => Promise<void>) {
    try {
      await action()
    } catch (error) {
      show(errorMessageOf(error, t('errors.generic')), 'error')
    }
  }

  function onBackup() {
    return runAndToast(async () => {
      const result = await createBackup.mutateAsync()
      if ('path' in result) {
        show(t('settings.data.backupSuccess'))
      }
    })
  }

  function onRestoreStart() {
    return runAndToast(async () => {
      const result = await restoreBackup.mutateAsync({ phase: 'select' })
      if ('fileName' in result) {
        setRestoreFileName(result.fileName)
        setIsRestoreOpen(true)
      }
    })
  }

  function onRestoreConfirm() {
    setIsRestoreOpen(false)
    return runAndToast(async () => {
      await restoreBackup.mutateAsync({ phase: 'confirm' })
      setIsRestarting(true)
    })
  }

  function onRestoreCancel() {
    setIsRestoreOpen(false)
  }

  function onDeleteStart() {
    setIsDeleteOpen(true)
  }

  function onDeleteConfirm() {
    setIsDeleteOpen(false)
    return runAndToast(async () => {
      await deleteAutomatic.mutateAsync()
      show(t('settings.data.deleteSuccess'))
    })
  }

  function onDeleteCancel() {
    setIsDeleteOpen(false)
  }

  function onRetry() {
    void status.refetch()
  }

  return {
    statusText: resolveStatusText(),
    warningText: isWarning ? t('settings.data.status.recommended') : '',
    isLoading,
    isError,
    isWarning,
    automaticCount,
    onBackup,
    onRestoreStart,
    restoreDialog: { open: isRestoreOpen, fileName: restoreFileName },
    onRestoreConfirm,
    onRestoreCancel,
    deleteDialog: { open: isDeleteOpen },
    onDeleteStart,
    onDeleteConfirm,
    onDeleteCancel,
    onRetry,
    toast,
    dismissToast: dismiss,
    isBusy
  }
}
