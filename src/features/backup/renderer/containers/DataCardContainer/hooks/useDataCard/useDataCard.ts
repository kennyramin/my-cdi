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
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const statusView = getBackupStatusView(status.data?.lastBackupAt ?? null, new Date())
  const automaticCount = status.data?.automaticCount ?? 0
  const isBusy =
    createBackup.isPending ||
    restoreBackup.isPending ||
    deleteAutomatic.isPending ||
    status.isPending

  function resolveStatusText(): string {
    if (statusView.kind === 'never') {
      return t('settings.data.status.never')
    }
    if (statusView.days === 0) {
      return t('settings.data.status.today')
    }
    return t('settings.data.status.days', { count: statusView.days })
  }

  async function onBackup() {
    try {
      const result = await createBackup.mutateAsync()
      if ('path' in result) {
        show(t('settings.data.backupSuccess'))
      }
    } catch (error) {
      show(errorMessageOf(error, t('errors.generic')), 'error')
    }
  }

  async function onRestoreStart() {
    try {
      const result = await restoreBackup.mutateAsync({ phase: 'select' })
      if ('fileName' in result) {
        setRestoreFileName(result.fileName)
      }
    } catch (error) {
      show(errorMessageOf(error, t('errors.generic')), 'error')
    }
  }

  async function onRestoreConfirm() {
    setRestoreFileName(null)
    try {
      await restoreBackup.mutateAsync({ phase: 'confirm' })
    } catch (error) {
      show(errorMessageOf(error, t('errors.generic')), 'error')
    }
  }

  function onRestoreCancel() {
    setRestoreFileName(null)
  }

  function onDeleteStart() {
    setIsDeleteOpen(true)
  }

  async function onDeleteConfirm() {
    setIsDeleteOpen(false)
    try {
      await deleteAutomatic.mutateAsync()
      show(t('settings.data.deleteSuccess'))
    } catch (error) {
      show(errorMessageOf(error, t('errors.generic')), 'error')
    }
  }

  function onDeleteCancel() {
    setIsDeleteOpen(false)
  }

  return {
    statusText: resolveStatusText(),
    isWarning: statusView.kind === 'never' || statusView.isWarning,
    automaticCount,
    onBackup,
    onRestoreStart,
    restoreDialog: { open: restoreFileName !== null, fileName: restoreFileName ?? '' },
    onRestoreConfirm,
    onRestoreCancel,
    deleteDialog: { open: isDeleteOpen },
    onDeleteStart,
    onDeleteConfirm,
    onDeleteCancel,
    toast,
    dismissToast: dismiss,
    isBusy
  }
}
