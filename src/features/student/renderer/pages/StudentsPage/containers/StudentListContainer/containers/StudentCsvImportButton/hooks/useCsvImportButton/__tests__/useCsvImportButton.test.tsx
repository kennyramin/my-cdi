import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChangeEvent, ReactNode } from 'react'
import '@shared/i18n/config'
import { readFileBuffer } from '../../../helpers/decodeCsvFile'
import { useCsvImportButton } from '../useCsvImportButton'

const FINGERPRINT = 'fingerprint-of-the-previewed-removal'

vi.mock('../../../helpers/decodeCsvFile', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../helpers/decodeCsvFile')>()
  return { ...original, readFileBuffer: vi.fn(original.readFileBuffer) }
})

const CSV_CONTENT = 'Nom de famille;Prenom 1;INE;Division\nDupont;Jean;123A;3ème A\n'
const FILE_NAME = 'eleves.csv'
const TOTAL_STUDENTS = 100

type CsvImportButtonState = ReturnType<typeof useCsvImportButton>

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createCsvFile(): File {
  return new File([CSV_CONTENT], FILE_NAME, { type: 'text/csv' })
}

function Harness(props: {
  onState: (state: CsvImportButtonState) => void
  onFileEvent: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const state = useCsvImportButton()
  props.onState(state)
  return <input type="file" data-testid="csv-input" onChange={props.onFileEvent} />
}

function setup() {
  const states: CsvImportButtonState[] = []
  const fileEvents: ChangeEvent<HTMLInputElement>[] = []
  render(
    <Harness
      onState={(state) => states.push(state)}
      onFileEvent={(event) => fileEvents.push(event)}
    />,
    { wrapper: createWrapper() }
  )
  const input = screen.getByTestId('csv-input')
  const selectFile = (file: File = createCsvFile()) => {
    fireEvent.change(input, { target: { files: [file] } })
    const event = fileEvents[fileEvents.length - 1]
    if (event === undefined) {
      throw new Error('change event never fired')
    }
    act(() => {
      latest(states).handleFileChange(event)
    })
    return latest(states)
  }
  return { states, selectFile }
}

function latest(states: CsvImportButtonState[]): CsvImportButtonState {
  const state = states[states.length - 1]
  if (state === undefined) {
    throw new Error('hook never rendered')
  }
  return state
}

describe('useCsvImportButton', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      student: {
        importCsv: vi.fn().mockResolvedValue({
          success: true,
          data: { created: 1, updated: 0, errors: 0, errorDetails: [] }
        })
      }
    })
  })

  it('starts with a closed modal and no pending file', () => {
    const { states } = setup()
    const state = latest(states)
    expect(state.isModalOpen).toBe(false)
    expect(state.pendingFile).toBeNull()
    expect(state.result).toBeNull()
    expect(state.error).toBeNull()
  })

  it('opens and closes the modal, resetting pending state', () => {
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    expect(latest(states).isModalOpen).toBe(true)

    selectFile()
    expect(latest(states).pendingFile?.name).toBe(FILE_NAME)

    act(() => {
      latest(states).closeModal()
    })
    expect(latest(states).isModalOpen).toBe(false)
    expect(latest(states).pendingFile).toBeNull()
    expect(latest(states).error).toBeNull()
  })

  it('submits the decoded csv content to student.importCsv', async () => {
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() =>
      expect(window.electronAPI.student.importCsv).toHaveBeenCalledWith({
        csv: CSV_CONTENT,
        onDuplicateIne: 'skip'
      })
    )
    expect(latest(states).error).toBeNull()
    expect(latest(states).isModalOpen).toBe(false)
  })

  it('closes the modal automatically when no row errors occurred', async () => {
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(window.electronAPI.student.importCsv).toHaveBeenCalledOnce())
    expect(latest(states).isModalOpen).toBe(false)
    expect(latest(states).pendingFile).toBeNull()
  })

  it('keeps the modal open and stores the result when row errors occurred', async () => {
    vi.stubGlobal('electronAPI', {
      student: {
        importCsv: vi.fn().mockResolvedValue({
          success: true,
          data: {
            created: 0,
            updated: 0,
            errors: 1,
            errorDetails: [{ type: 'DUPLICATE_INE', studentName: 'Jean Dupont' }]
          }
        })
      }
    })
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).result).not.toBeNull())
    expect(latest(states).isModalOpen).toBe(true)
  })

  it('sends onDuplicateIne replace when update existing is toggled on', async () => {
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    expect(latest(states).updateExisting).toBe(false)

    act(() => {
      latest(states).handleToggleUpdateExisting()
    })
    expect(latest(states).updateExisting).toBe(true)
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() =>
      expect(window.electronAPI.student.importCsv).toHaveBeenCalledWith({
        csv: CSV_CONTENT,
        onDuplicateIne: 'replace'
      })
    )
  })

  it('shows a success toast and closes the modal on a fully successful import', async () => {
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).toast).not.toBeNull())
    expect(latest(states).toast?.severity).toBe('success')
    expect(latest(states).isModalOpen).toBe(false)
  })

  it('downloads an error report when handleDownloadReport is called', async () => {
    vi.stubGlobal('electronAPI', {
      student: {
        importCsv: vi.fn().mockResolvedValue({
          success: true,
          data: {
            created: 0,
            updated: 0,
            errors: 1,
            errorDetails: [{ type: 'DUPLICATE_INE', studentName: 'Jean Dupont' }]
          }
        })
      }
    })
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).result).not.toBeNull())
    expect(latest(states).canDownloadReport).toBe(true)

    const createObjectURL = vi.fn().mockReturnValue('blob:report-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)

    act(() => {
      latest(states).handleDownloadReport()
    })

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report-url')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('does not allow downloading a report without a result', () => {
    const { states } = setup()
    expect(latest(states).canDownloadReport).toBe(false)
  })

  it('surfaces the ipc error when the import fails', async () => {
    vi.stubGlobal('electronAPI', {
      student: {
        importCsv: vi.fn().mockResolvedValue({ success: false, error: 'boom' })
      }
    })
    const { states, selectFile } = setup()
    act(() => {
      latest(states).openModal()
    })
    selectFile()

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).error).toBe('boom'))
    expect(latest(states).result).toBeNull()
    expect(latest(states).isModalOpen).toBe(true)
  })
})

describe('useCsvImportButton removal of absent students', () => {
  const SAMPLE_NAMES = ['Anne Martin', 'Jean Dupont']
  const IMPORT_OK = {
    success: true,
    data: {
      created: 0,
      updated: 1,
      errors: 0,
      errorDetails: [],
      anonymized: 1,
      deletedWithoutVisits: 0
    }
  }

  function stubApi(preview: unknown, importCsv: unknown = vi.fn().mockResolvedValue(IMPORT_OK)) {
    const previewCsvRemoval = vi.fn().mockResolvedValue({ success: true, data: preview })
    vi.stubGlobal('electronAPI', { student: { importCsv, previewCsvRemoval } })
    return { previewCsvRemoval, importCsv }
  }

  async function openWithFile(states: CsvImportButtonState[], selectFile: () => unknown) {
    act(() => {
      latest(states).openModal()
    })
    selectFile()
  }

  async function checkRemoval(states: CsvImportButtonState[]) {
    await act(async () => {
      latest(states).handleToggleRemoveAbsent()
    })
  }

  it('is OFF by default with no preview', () => {
    stubApi({ toRemove: 0, total: 0, sample: [], fingerprint: FINGERPRINT })
    const { states } = setup()
    expect(latest(states).removeAbsent).toBe(false)
    expect(latest(states).removalPreview).toBeNull()
    expect(latest(states).confirmationText).toBe('')
  })

  it('turns updateExisting on and restores the previous choice when unchecked', async () => {
    stubApi({ toRemove: 0, total: 1, sample: [], fingerprint: FINGERPRINT })
    const { states } = setup()
    expect(latest(states).updateExisting).toBe(false)
    await checkRemoval(states)
    expect(latest(states).updateExisting).toBe(true)
    await checkRemoval(states)
    expect(latest(states).removeAbsent).toBe(false)
    expect(latest(states).updateExisting).toBe(false)
  })

  it('keeps updateExisting on when the user had enabled it before', async () => {
    stubApi({ toRemove: 0, total: 1, sample: [], fingerprint: FINGERPRINT })
    const { states } = setup()
    act(() => {
      latest(states).handleToggleUpdateExisting()
    })
    await checkRemoval(states)
    await checkRemoval(states)
    expect(latest(states).updateExisting).toBe(true)
  })

  it('requests the preview with the decoded csv when a file is chosen after checking', async () => {
    const { previewCsvRemoval } = stubApi({
      toRemove: 2,
      total: 5,
      sample: SAMPLE_NAMES,
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledWith({ csv: CSV_CONTENT }))
    await waitFor(() => expect(latest(states).removalPreview?.toRemove).toBe(2))
    expect(latest(states).removalPreview?.sample).toEqual(SAMPLE_NAMES)
  })

  it('requests the preview when the file is chosen while already checked', async () => {
    const { previewCsvRemoval } = stubApi({
      toRemove: 2,
      total: 5,
      sample: SAMPLE_NAMES,
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await checkRemoval(states)
    expect(previewCsvRemoval).not.toHaveBeenCalled()
    await act(async () => {
      selectFile()
    })
    await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledWith({ csv: CSV_CONTENT }))
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
  })

  it('does not request a preview while the option is off', async () => {
    const { previewCsvRemoval } = stubApi({
      toRemove: 0,
      total: 0,
      sample: [],
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    expect(previewCsvRemoval).not.toHaveBeenCalled()
  })

  it('blocks submit for a blocked preview', async () => {
    stubApi({
      toRemove: 0,
      total: 5,
      sample: [],
      fingerprint: FINGERPRINT,
      blockedReason: 'rowErrors'
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).canSubmit).toBe(false)
  })

  it('blocks submit for an empty file', async () => {
    stubApi({
      toRemove: 0,
      total: 5,
      sample: [],
      fingerprint: FINGERPRINT,
      blockedReason: 'emptyFile'
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).canSubmit).toBe(false)
  })

  it('keeps submit disabled until the preview has loaded', async () => {
    stubApi({ toRemove: 1, total: 5, sample: ['Jean Dupont'], fingerprint: FINGERPRINT })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    expect(latest(states).canSubmit).toBe(true)
    await checkRemoval(states)
    expect(latest(states).canSubmit).toBe(false)
    await waitFor(() => expect(latest(states).canSubmit).toBe(true))
  })

  it('keeps submit disabled and surfaces the error when the preview fails', async () => {
    vi.stubGlobal('electronAPI', {
      student: {
        importCsv: vi.fn(),
        previewCsvRemoval: vi.fn().mockResolvedValue({ success: false, error: 'boom' })
      }
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).previewError).toBe('boom'))
    expect(latest(states).canSubmit).toBe(false)
  })

  it('allows submit when there is nothing to remove', async () => {
    stubApi({ toRemove: 0, total: 5, sample: [], fingerprint: FINGERPRINT })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).needsConfirmation).toBe(false)
    expect(latest(states).canSubmit).toBe(true)
  })

  it('requires the exact typed phrase over the threshold, case and spaces tolerated', async () => {
    stubApi({ toRemove: 12, total: TOTAL_STUDENTS, sample: SAMPLE_NAMES, fingerprint: FINGERPRINT })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).needsConfirmation).toBe(true)
    expect(latest(states).confirmationPhrase).toBe('RETIRER 12')
    expect(latest(states).canSubmit).toBe(false)

    act(() => {
      latest(states).handleConfirmationChange('retirer 1')
    })
    expect(latest(states).canSubmit).toBe(false)

    act(() => {
      latest(states).handleConfirmationChange('  retirer 12 ')
    })
    expect(latest(states).canSubmit).toBe(true)
  })

  it('does not need a confirmation below the threshold', async () => {
    stubApi({ toRemove: 2, total: TOTAL_STUDENTS, sample: SAMPLE_NAMES, fingerprint: FINGERPRINT })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).needsConfirmation).toBe(false)
    expect(latest(states).canSubmit).toBe(true)
  })

  it('sends removeAbsent and the typed confirmation on submit', async () => {
    const { importCsv } = stubApi({
      toRemove: 12,
      total: TOTAL_STUDENTS,
      sample: SAMPLE_NAMES,
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    act(() => {
      latest(states).handleConfirmationChange('retirer 12')
    })

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() =>
      expect(importCsv).toHaveBeenCalledWith({
        csv: CSV_CONTENT,
        onDuplicateIne: 'replace',
        removeAbsent: true,
        removalConfirmation: 'retirer 12',
        removalExpectation: { count: 12, fingerprint: FINGERPRINT }
      })
    )
  })

  it('sends neither field when the option is unchecked', async () => {
    const { importCsv } = stubApi({
      toRemove: 2,
      total: 5,
      sample: SAMPLE_NAMES,
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await checkRemoval(states)

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() =>
      expect(importCsv).toHaveBeenCalledWith({ csv: CSV_CONTENT, onDuplicateIne: 'skip' })
    )
  })

  it('shows the real removal counts in the success toast', async () => {
    stubApi(
      { toRemove: 5, total: TOTAL_STUDENTS / 2, sample: ['Jean Dupont'], fingerprint: FINGERPRINT },
      vi.fn().mockResolvedValue({
        success: true,
        data: {
          created: 0,
          updated: 1,
          errors: 0,
          errorDetails: [],
          anonymized: 4,
          deletedWithoutVisits: 7
        }
      })
    )
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).toast).not.toBeNull())
    expect(latest(states).toast?.message).toContain('4 anonymisé(s), 7 supprimé(s) sans visite')
  })

  it('re-runs the preview, clears the confirmation and explains when the main process refuses', async () => {
    const { previewCsvRemoval } = stubApi(
      { toRemove: 12, total: TOTAL_STUDENTS, sample: ['Jean Dupont'], fingerprint: FINGERPRINT },
      vi.fn().mockResolvedValue({ success: false, error: 'refused' })
    )
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    act(() => {
      latest(states).handleConfirmationChange('RETIRER 12')
    })

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(latest(states).error).toContain('aperçu'))
    expect(latest(states).error).not.toBe('refused')
    expect(latest(states).confirmationText).toBe('')
    expect(latest(states).isModalOpen).toBe(true)
    expect(latest(states).removeAbsent).toBe(true)
  })

  it('sends the refreshed fingerprint when the user retries after a refusal', async () => {
    const REFRESHED_FINGERPRINT = 'fingerprint-after-the-file-changed'
    const importCsv = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'refused' })
      .mockResolvedValue(IMPORT_OK)
    const { previewCsvRemoval } = stubApi(
      { toRemove: 2, total: TOTAL_STUDENTS, sample: ['Jean Dupont'], fingerprint: FINGERPRINT },
      importCsv
    )
    previewCsvRemoval
      .mockResolvedValueOnce({
        success: true,
        data: { toRemove: 2, total: TOTAL_STUDENTS, sample: [], fingerprint: FINGERPRINT }
      })
      .mockResolvedValue({
        success: true,
        data: { toRemove: 3, total: TOTAL_STUDENTS, sample: [], fingerprint: REFRESHED_FINGERPRINT }
      })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).removalPreview?.toRemove).toBe(3))

    await act(async () => {
      latest(states).handleSubmit()
    })

    await waitFor(() =>
      expect(importCsv).toHaveBeenLastCalledWith(
        expect.objectContaining({
          removalExpectation: { count: 3, fingerprint: REFRESHED_FINGERPRINT }
        })
      )
    )
  })

  it('shows the plain error when the import fails without removal', async () => {
    stubApi(
      { toRemove: 0, total: 1, sample: [], fingerprint: FINGERPRINT },
      vi.fn().mockResolvedValue({ success: false, error: 'refused' })
    )
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).error).toBe('refused'))
  })

  it('unchecks removal and clears the preview after a removal that left row errors', async () => {
    stubApi(
      { toRemove: 12, total: TOTAL_STUDENTS, sample: ['Jean Dupont'], fingerprint: FINGERPRINT },
      vi.fn().mockResolvedValue({
        success: true,
        data: {
          created: 0,
          updated: 0,
          errors: 1,
          errorDetails: [{ type: 'DUPLICATE_INE', studentName: 'Jean Dupont' }],
          anonymized: 12,
          deletedWithoutVisits: 0
        }
      })
    )
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    act(() => {
      latest(states).handleConfirmationChange('RETIRER 12')
    })

    await act(async () => {
      latest(states).handleSubmit()
    })
    await waitFor(() => expect(latest(states).result).not.toBeNull())
    expect(latest(states).isModalOpen).toBe(true)
    expect(latest(states).removeAbsent).toBe(false)
    expect(latest(states).removalPreview).toBeNull()
    expect(latest(states).confirmationText).toBe('')
  })

  it('does not submit when canSubmit is false', async () => {
    const { importCsv } = stubApi({
      toRemove: 12,
      total: TOTAL_STUDENTS,
      sample: [],
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    await act(async () => {
      latest(states).handleSubmit()
    })
    expect(importCsv).not.toHaveBeenCalled()
  })

  it('retries the preview after a failure', async () => {
    const previewCsvRemoval = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockResolvedValueOnce({
        success: true,
        data: { toRemove: 0, total: 3, sample: [], fingerprint: FINGERPRINT }
      })
    vi.stubGlobal('electronAPI', { student: { importCsv: vi.fn(), previewCsvRemoval } })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).previewError).toBe('boom'))
    await act(async () => {
      latest(states).handleRetryPreview()
    })
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    expect(latest(states).previewError).toBeNull()
  })

  it('re-requests the preview and clears the typed confirmation when the file changes', async () => {
    const { previewCsvRemoval } = stubApi({
      toRemove: 12,
      total: TOTAL_STUDENTS,
      sample: SAMPLE_NAMES,
      fingerprint: FINGERPRINT
    })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    await waitFor(() => expect(latest(states).removalPreview).not.toBeNull())
    act(() => {
      latest(states).handleConfirmationChange('RETIRER 12')
    })
    expect(previewCsvRemoval).toHaveBeenCalledTimes(1)

    await act(async () => {
      selectFile()
    })
    await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledTimes(2))
    expect(latest(states).confirmationText).toBe('')
  })

  it('resets the option to OFF when the modal is closed', async () => {
    stubApi({ toRemove: 0, total: 5, sample: [], fingerprint: FINGERPRINT })
    const { states, selectFile } = setup()
    await openWithFile(states, selectFile)
    await checkRemoval(states)
    act(() => {
      latest(states).closeModal()
    })
    expect(latest(states).removeAbsent).toBe(false)
    expect(latest(states).removalPreview).toBeNull()
  })

  describe('stale preview guards', () => {
    function deferred() {
      let release: (buffer: ArrayBuffer) => void = () => undefined
      const promise = new Promise<ArrayBuffer>((resolve) => {
        release = resolve
      })
      return { promise, release }
    }
    const encode = (text: string) => new TextEncoder().encode(text).buffer

    it('ignores the decode of file A when file B was chosen meanwhile', async () => {
      const { previewCsvRemoval } = stubApi({
        toRemove: 0,
        total: 1,
        sample: [],
        fingerprint: FINGERPRINT
      })
      const slow = deferred()
      vi.mocked(readFileBuffer).mockReturnValueOnce(slow.promise)
      const { states, selectFile } = setup()
      await checkRemoval(states)
      const fileA = new File(['a'], 'a.csv')
      const fileB = new File(['b'], 'b.csv')
      await act(async () => {
        selectFile(fileA)
      })
      await act(async () => {
        vi.mocked(readFileBuffer).mockResolvedValueOnce(encode('B-CONTENT'))
        selectFile(fileB)
      })
      await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledTimes(1))
      await act(async () => {
        slow.release(encode('A-CONTENT'))
      })
      expect(previewCsvRemoval).toHaveBeenCalledTimes(1)
      expect(previewCsvRemoval).toHaveBeenCalledWith({ csv: 'B-CONTENT' })
    })

    it('ignores a decode finishing after the option was toggled off', async () => {
      const { previewCsvRemoval } = stubApi({
        toRemove: 0,
        total: 1,
        sample: [],
        fingerprint: FINGERPRINT
      })
      const slow = deferred()
      const { states, selectFile } = setup()
      await openWithFile(states, selectFile)
      vi.mocked(readFileBuffer).mockReturnValueOnce(slow.promise)
      await checkRemoval(states)
      await checkRemoval(states)
      await act(async () => {
        slow.release(encode(CSV_CONTENT))
      })
      expect(previewCsvRemoval).not.toHaveBeenCalled()
      expect(latest(states).removalPreview).toBeNull()
    })

    it('requests the preview once when toggled off then on during the read', async () => {
      const { previewCsvRemoval } = stubApi({
        toRemove: 0,
        total: 1,
        sample: [],
        fingerprint: FINGERPRINT
      })
      const slow = deferred()
      const { states, selectFile } = setup()
      await openWithFile(states, selectFile)
      vi.mocked(readFileBuffer).mockReturnValueOnce(slow.promise)
      await checkRemoval(states)
      await checkRemoval(states)
      await checkRemoval(states)
      await act(async () => {
        slow.release(encode(CSV_CONTENT))
      })
      await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalledTimes(1))
    })

    it('shows no preview that arrives after the modal was closed', async () => {
      let answer: (value: unknown) => void = () => undefined
      const previewCsvRemoval = vi.fn(
        () =>
          new Promise((resolve) => {
            answer = resolve
          })
      )
      vi.stubGlobal('electronAPI', { student: { importCsv: vi.fn(), previewCsvRemoval } })
      const { states, selectFile } = setup()
      await openWithFile(states, selectFile)
      await checkRemoval(states)
      await waitFor(() => expect(previewCsvRemoval).toHaveBeenCalled())
      act(() => {
        latest(states).closeModal()
      })
      await act(async () => {
        answer({
          success: true,
          data: { toRemove: 3, total: 5, sample: ['X Y'], fingerprint: FINGERPRINT }
        })
      })
      expect(latest(states).removalPreview).toBeNull()
      act(() => {
        latest(states).openModal()
      })
      expect(latest(states).removalPreview).toBeNull()
      expect(latest(states).removeAbsent).toBe(false)
    })
  })
})
