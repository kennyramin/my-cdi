import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@ui/components/ConfirmDialog'
import { Toast } from '@ui/components/Toast'
import { useDataCard } from './hooks/useDataCard'
import { DataCardPresenter } from './presenters/DataCardPresenter'

export function DataCardContainer() {
  const { t } = useTranslation('common')
  const card = useDataCard()

  return (
    <>
      <DataCardPresenter
        statusText={card.statusText}
        isWarning={card.isWarning}
        automaticCount={card.automaticCount}
        isBusy={card.isBusy}
        onBackup={card.onBackup}
        onRestoreStart={card.onRestoreStart}
        onDeleteStart={card.onDeleteStart}
      />
      <ConfirmDialog
        open={card.restoreDialog.open}
        title={t('settings.data.restoreDialog.title')}
        message={t('settings.data.restoreDialog.message', {
          fileName: card.restoreDialog.fileName
        })}
        confirmLabel={t('settings.data.restoreDialog.confirm')}
        destructive
        onConfirm={card.onRestoreConfirm}
        onClose={card.onRestoreCancel}
      />
      <ConfirmDialog
        open={card.deleteDialog.open}
        title={t('settings.data.deleteDialog.title')}
        message={t('settings.data.deleteDialog.message')}
        confirmLabel={t('settings.data.deleteDialog.confirm')}
        destructive
        onConfirm={card.onDeleteConfirm}
        onClose={card.onDeleteCancel}
      />
      <Toast toast={card.toast} onClose={card.dismissToast} />
    </>
  )
}
