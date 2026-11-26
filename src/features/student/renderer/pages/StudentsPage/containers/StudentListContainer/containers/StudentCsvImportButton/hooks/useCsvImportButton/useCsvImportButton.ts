import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useImportStudentsCsv, usePreviewCsvRemoval } from '@student/api/useStudentMutations'
import { useToast } from '@ui/hooks/useToast'
import { downloadTextFile } from '@ui/helpers/downloadTextFile'
import {
  buildRemovalConfirmation,
  isRemovalConfirmed,
  requiresRemovalConfirmation
} from '@student-shared'
import type { CsvImportResult, CsvRemovalPreview } from '@student-shared'
import type { ToastContent } from '@ui/components/Toast'
import { readFileBuffer, decodeText } from '../../helpers/decodeCsvFile'
import { formatImportError } from '../../helpers/formatImportError'
import { buildErrorReport } from '../../helpers/buildErrorReport'
import { buildReportFileName } from '../../helpers/buildReportFileName'

export interface CsvImportButtonState {
  isModalOpen: boolean
  pendingFile: File | null
  result: CsvImportResult | null
  errorLines: string[]
  error: string | null
  isPending: boolean
  inputRef: RefObject<HTMLInputElement | null>
  toast: ToastContent | null
  canDownloadReport: boolean
  updateExisting: boolean
  removeAbsent: boolean
  removalPreview: CsvRemovalPreview | null
  isPreviewPending: boolean
  previewError: string | null
  confirmationText: string
  confirmationPhrase: string
  needsConfirmation: boolean
  canSubmit: boolean
}

export interface CsvImportButtonActions {
  openModal: () => void
  closeModal: () => void
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleDropzoneClick: () => void
  handleDropzoneKeyDown: (event: KeyboardEvent) => void
  handleSubmit: () => void
  handleToggleUpdateExisting: () => void
  handleToggleRemoveAbsent: () => void
  handleRetryPreview: () => void
  handleConfirmationChange: (value: string) => void
  handleDownloadReport: () => void
  dismissToast: () => void
}

export function useCsvImportButton(): CsvImportButtonState & CsvImportButtonActions {
  const { t: tCommon } = useTranslation('common')
  const { t: tStudent } = useTranslation('student')
  const { toast, show, dismiss } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [removeAbsent, setRemoveAbsent] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const previewRequestRef = useRef(0)
  const {
    mutate: requestPreview,
    reset: resetPreview,
    data: previewData,
    isPending: isPreviewPending,
    error: previewFailure
  } = usePreviewCsvRemoval()
  const { mutate: importStudents, isPending } = useImportStudentsCsv()

  const removalPreview = removeAbsent ? (previewData ?? null) : null
  const previewError = removeAbsent ? (previewFailure?.message ?? null) : null
  const effectiveUpdateExisting = updateExisting || removeAbsent

  function cancelPreview() {
    previewRequestRef.current += 1
    resetPreview()
    setConfirmationText('')
  }

  async function loadPreview(file: File) {
    previewRequestRef.current += 1
    const requestId = previewRequestRef.current
    resetPreview()
    setConfirmationText('')
    try {
      const csv = decodeText(await readFileBuffer(file))
      if (previewRequestRef.current === requestId) {
        requestPreview({ csv })
      }
    } catch {
      setError(tStudent('csvImport.fileReadError'))
    }
  }

  function openModal() {
    setIsModalOpen(true)
    setResult(null)
    setError(null)
  }

  function closeModal() {
    setIsModalOpen(false)
    setPendingFile(null)
    setResult(null)
    setError(null)
    setRemoveAbsent(false)
    cancelPreview()
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setPendingFile(file)
    setResult(null)
    setError(null)
    if (removeAbsent) {
      void loadPreview(file)
    } else {
      cancelPreview()
    }
  }

  function handleDropzoneClick() {
    inputRef.current?.click()
  }

  function handleDropzoneKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleDropzoneClick()
    }
  }

  function handleToggleUpdateExisting() {
    setUpdateExisting((previous) => !previous)
  }

  function handleToggleRemoveAbsent() {
    const next = !removeAbsent
    setRemoveAbsent(next)
    setError(null)
    if (next && pendingFile) {
      void loadPreview(pendingFile)
    } else {
      cancelPreview()
    }
  }

  function handleRetryPreview() {
    if (removeAbsent && pendingFile) {
      void loadPreview(pendingFile)
    }
  }

  function handleConfirmationChange(value: string) {
    setConfirmationText(value)
  }

  function handleDownloadReport() {
    if (!result || !pendingFile) {
      return
    }
    const report = buildErrorReport({
      fileName: pendingFile.name,
      created: result.created,
      updated: result.updated,
      errorLines: result.errorDetails.map((errorDetail) =>
        formatImportError(errorDetail, tStudent)
      ),
      translate: tStudent
    })
    downloadTextFile(report, buildReportFileName(pendingFile.name, new Date()))
  }

  async function handleSubmit() {
    if (!canSubmit || !pendingFile) {
      return
    }
    const removalRequested = removeAbsent
    const submittedFile = pendingFile

    try {
      const buffer = await readFileBuffer(pendingFile)
      const csv = decodeText(buffer)

      const payload = {
        csv,
        onDuplicateIne: effectiveUpdateExisting ? ('replace' as const) : ('skip' as const)
      }

      importStudents(
        removeAbsent
          ? {
              ...payload,
              removeAbsent: true,
              removalConfirmation: confirmationText,
              removalExpectation: {
                count: removalPreview?.toRemove ?? 0,
                fingerprint: removalPreview?.fingerprint ?? ''
              }
            }
          : payload,
        {
          onSuccess: (data) => {
            setResult(data)
            if (removalRequested) {
              setRemoveAbsent(false)
              cancelPreview()
            }
            if (data.errors === 0) {
              closeModal()
              show(
                removalRequested
                  ? tStudent('csvImport.summaryWithRemoval', {
                      summary: tStudent('csvImport.summary', {
                        count: data.created,
                        updated: data.updated,
                        errors: 0
                      }),
                      removal: formatRemovalSummary(data)
                    })
                  : tStudent('csvImport.summary', {
                      count: data.created,
                      updated: data.updated,
                      errors: 0
                    })
              )
            }
          },
          onError: (err) => {
            if (removalRequested) {
              setError(tStudent('csvImport.removalStale'))
              void loadPreview(submittedFile)
              return
            }
            setError(err instanceof Error ? err.message : tCommon('app.unknownError'))
          }
        }
      )
    } catch {
      setError(tStudent('csvImport.fileReadError'))
    }
  }

  function formatRemovalSummary(data: CsvImportResult): string {
    return tStudent('csvImport.removalSummary', {
      anonymized: data.anonymized ?? 0,
      deletedWithoutVisits: data.deletedWithoutVisits ?? 0
    })
  }

  const needsConfirmation =
    removalPreview !== null &&
    removalPreview.blockedReason === undefined &&
    requiresRemovalConfirmation(removalPreview.toRemove, removalPreview.total)
  const confirmationPhrase = buildRemovalConfirmation(removalPreview?.toRemove ?? 0)
  const isRemovalReady =
    removalPreview !== null &&
    removalPreview.blockedReason === undefined &&
    !isPreviewPending &&
    (!needsConfirmation || isRemovalConfirmed(confirmationText, removalPreview.toRemove))
  const canSubmit = pendingFile !== null && !isPending && (!removeAbsent || isRemovalReady)

  const errorLines: string[] = result
    ? result.errorDetails.map((errorDetail) => formatImportError(errorDetail, tStudent))
    : []

  return {
    isModalOpen,
    pendingFile,
    result,
    errorLines,
    error,
    isPending,
    inputRef,
    toast,
    canDownloadReport: result !== null && pendingFile !== null,
    updateExisting: effectiveUpdateExisting,
    removeAbsent,
    removalPreview,
    isPreviewPending,
    previewError,
    confirmationText,
    confirmationPhrase,
    needsConfirmation,
    canSubmit,
    openModal,
    closeModal,
    handleFileChange,
    handleDropzoneClick,
    handleDropzoneKeyDown,
    handleSubmit,
    handleToggleUpdateExisting,
    handleToggleRemoveAbsent,
    handleRetryPreview,
    handleConfirmationChange,
    handleDownloadReport,
    dismissToast: dismiss
  }
}
