import type { ToastSeverity } from '@ui/components/Toast'
import type { ExportScopeProps } from '../ExportScopeProps'

export type ExportDialogContainerProps = {
  open: boolean
  onClose: () => void
  onResult: (message: string, severity: ToastSeverity) => void
} & ExportScopeProps
