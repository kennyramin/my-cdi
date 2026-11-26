import { useTranslation } from 'react-i18next'
import { Button } from '@ui/components/Button'
import { Icon } from '@ui/components/Icon'
import { Toast } from '@ui/components/Toast'
import { useToast } from '@ui/hooks/useToast'
import { ExportDialogContainer } from '../ExportDialogContainer'
import { useExportButton } from './hooks/useExportButton'
import type { ExportButtonContainerProps } from './types/ExportButtonContainerProps'

export function ExportButtonContainer(props: ExportButtonContainerProps) {
  const { t } = useTranslation('export')
  const { toast, show, dismiss } = useToast()
  const { hasBeenOpened, session, isOpen, triggerRef, openDialog, closeDialog } = useExportButton()

  if (props.scope === 'students') {
    return null
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        iconLeft={<Icon name="file_download" />}
        onClick={openDialog}
        disabled={props.disabled}
        aria-describedby={props.disabled ? props.disabledDescriptionId : undefined}
      >
        {t('button.statistics')}
      </Button>
      {hasBeenOpened ? (
        <ExportDialogContainer
          key={session}
          open={isOpen}
          scope="statistics"
          period={props.period}
          onClose={closeDialog}
          onResult={show}
        />
      ) : null}
      <Toast toast={toast} onClose={dismiss} />
    </>
  )
}
