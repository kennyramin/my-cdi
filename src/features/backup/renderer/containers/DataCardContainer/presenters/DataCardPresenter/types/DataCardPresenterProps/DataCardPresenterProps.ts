export interface DataCardPresenterProps {
  statusText: string
  warningText: string
  isLoading: boolean
  isError: boolean
  isWarning: boolean
  onRetry: () => void
  automaticCount: number
  isBusy: boolean
  onBackup: () => void
  onRestoreStart: () => void
  onDeleteStart: () => void
}
