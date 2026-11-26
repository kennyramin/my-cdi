export interface DataCardPresenterProps {
  statusText: string
  isWarning: boolean
  automaticCount: number
  isBusy: boolean
  onBackup: () => void
  onRestoreStart: () => void
  onDeleteStart: () => void
}
