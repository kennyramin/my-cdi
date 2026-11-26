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

  const isStatistics = props.scope === 'statistics'
  const dialogNode =
    props.scope === 'statistics' ? (
      <ExportDialogContainer
        key={session}
        open={isOpen}
        scope="statistics"
        period={props.period}
        onClose={closeDialog}
        onResult={show}
      />
    ) : (
      <ExportDialogContainer
        key={session}
        open={isOpen}
        scope="students"
        onClose={closeDialog}
        onResult={show}
      />
    )

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        iconLeft={<Icon name="file_download" />}
        onClick={openDialog}
        disabled={isStatistics && props.disabled}
        aria-describedby={isStatistics && props.disabled ? props.disabledDescriptionId : undefined}
      >
        {t(isStatistics ? 'button.statistics' : 'button.students')}
      </Button>
      {hasBeenOpened ? dialogNode : null}
      <Toast toast={toast} onClose={dismiss} />
    </>
  )
}
