import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@shared/i18n/config'
import { ErrorCode } from '@lib/errors'
import { DataCardContainer } from '../DataCardContainer'

const AUTOMATIC_COUNT = 3
const LOADING_TEXT = 'Dernière sauvegarde : chargement…'
const OLD_BACKUP_DAYS = 12
const STALE_BACKUP_DAYS = 40
const MS_PER_DAY = 86_400_000

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </QueryClientProvider>
    )
  }
}

interface BackupStub {
  create: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  getStatus: ReturnType<typeof vi.fn>
  deleteAutomatic: ReturnType<typeof vi.fn>
}

function stubBackup(overrides: Partial<BackupStub> = {}): BackupStub {
  const backup: BackupStub = {
    create: vi.fn().mockResolvedValue({ success: true, data: { path: '/x/backup.db' } }),
    restore: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } }),
    getStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { lastBackupAt: null, automaticCount: AUTOMATIC_COUNT }
    }),
    deleteAutomatic: vi
      .fn()
      .mockResolvedValue({ success: true, data: { deleted: AUTOMATIC_COUNT } }),
    ...overrides
  }
  vi.stubGlobal('electronAPI', { backup })
  return backup
}

function failure(code: string, error = 'boom') {
  return { success: false, error, code }
}

function renderCard() {
  return render(<DataCardContainer />, { wrapper: makeWrapper() })
}

async function findStatus(text: string) {
  const status = await screen.findByText(text)
  expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
  return status
}

describe('DataCardContainer', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows "never" with the warning tone when never backed up', async () => {
    stubBackup()
    renderCard()

    const status = await findStatus('Dernière sauvegarde : jamais')
    expect(status).toHaveAttribute('data-warning', 'true')
  })

  it('shows the relative age', async () => {
    const lastBackupAt = new Date(Date.now() - OLD_BACKUP_DAYS * MS_PER_DAY).toISOString()
    stubBackup({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { lastBackupAt, automaticCount: 0 }
      })
    })
    renderCard()

    const status = await findStatus('Dernière sauvegarde : il y a 12 jours')
    expect(status).toHaveAttribute('data-warning', 'false')
  })

  it('shows today when the last backup is from today', async () => {
    stubBackup({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { lastBackupAt: new Date().toISOString(), automaticCount: 0 }
      })
    })
    renderCard()

    expect(await findStatus("Dernière sauvegarde : aujourd'hui")).toBeInTheDocument()
  })

  it('shows the privacy sentence', async () => {
    stubBackup()
    renderCard()

    expect(
      await screen.findByText(
        'Les fichiers de sauvegarde contiennent les noms des élèves et ne sont pas chiffrés : conservez-les en lieu sûr.'
      )
    ).toBeInTheDocument()
  })

  it('backs up, shows a success toast and refetches the status', async () => {
    const backup = stubBackup()
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Sauvegarder maintenant' }))

    expect(await screen.findByText('Sauvegarde enregistrée')).toBeInTheDocument()
    expect(backup.create).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(backup.getStatus).toHaveBeenCalledTimes(2))
  })

  it('shows no toast when the backup is cancelled', async () => {
    const backup = stubBackup({
      create: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } })
    })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Sauvegarder maintenant' }))

    await waitFor(() => expect(backup.create).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Sauvegarde enregistrée')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the translated error toast when the backup fails', async () => {
    stubBackup({ create: vi.fn().mockResolvedValue(failure(ErrorCode.BACKUP_WRITE_FAILED)) })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Sauvegarder maintenant' }))

    expect(await screen.findByText("L'écriture de la sauvegarde a échoué")).toBeInTheDocument()
  })

  it('opens no dialog when the file picker is cancelled', async () => {
    const backup = stubBackup()
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))

    await waitFor(() => expect(backup.restore).toHaveBeenCalledWith({ phase: 'select' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the confirmation naming the file and not the path', async () => {
    stubBackup({
      restore: vi.fn().mockResolvedValue({ success: true, data: { fileName: 'cdi-2026.db' } })
    })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/cdi-2026\.db/)).toBeInTheDocument()
    expect(within(dialog).getByText(/copie de sécurité/)).toBeInTheDocument()
    expect(within(dialog).getByText(/redémarre/)).toBeInTheDocument()
  })

  it('calls restore confirm exactly once when confirming', async () => {
    const restore = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { fileName: 'cdi-2026.db' } })
      .mockResolvedValue({ success: true, data: { restored: true } })
    stubBackup({ restore })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurer' }))

    await waitFor(() => expect(restore).toHaveBeenCalledTimes(2))
    expect(restore).toHaveBeenLastCalledWith({ phase: 'confirm' })
  })

  it('never calls confirm when the confirmation is cancelled', async () => {
    const restore = vi.fn().mockResolvedValue({ success: true, data: { fileName: 'cdi-2026.db' } })
    stubBackup({ restore })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('shows the translated message when the selected backup is newer', async () => {
    stubBackup({ restore: vi.fn().mockResolvedValue(failure(ErrorCode.RESTORE_NEWER_VERSION)) })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))

    expect(
      await screen.findByText(
        "Cette sauvegarde provient d'une version plus récente de l'application"
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the dialog and shows an error toast when the confirmed restore fails', async () => {
    const restore = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { fileName: 'cdi-2026.db' } })
      .mockResolvedValue(failure(ErrorCode.RESTORE_CORRUPTED))
    stubBackup({ restore })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurer' }))

    expect(await screen.findByText('Cette sauvegarde est corrompue')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows the count on the delete button and disables it at 0', async () => {
    stubBackup()
    const { unmount } = renderCard()

    expect(
      await screen.findByRole('button', { name: 'Supprimer les sauvegardes automatiques (3)' })
    ).toBeEnabled()
    unmount()

    stubBackup({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { lastBackupAt: null, automaticCount: 0 }
      })
    })
    renderCard()

    expect(
      await screen.findByRole('button', { name: 'Supprimer les sauvegardes automatiques (0)' })
    ).toBeDisabled()
  })

  it('asks for confirmation then deletes and refetches the count', async () => {
    const backup = stubBackup()
    renderCard()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer les sauvegardes automatiques (3)' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(backup.deleteAutomatic).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(backup.deleteAutomatic).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(backup.getStatus).toHaveBeenCalledTimes(2))
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const backup = stubBackup()
    renderCard()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer les sauvegardes automatiques (3)' })
    )
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(backup.deleteAutomatic).not.toHaveBeenCalled()
  })

  it('disables the buttons while an operation runs', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined
    stubBackup({
      create: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve
          })
      )
    })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')

    await userEvent.click(screen.getByRole('button', { name: 'Sauvegarder maintenant' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Supprimer les sauvegardes automatiques (3)' })
    ).toBeDisabled()
    resolveCreate({ success: true, data: { cancelled: true } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeEnabled()
    )
  })

  it('shows a neutral placeholder, not "jamais", while the status loads', async () => {
    let resolveStatus: (value: unknown) => void = () => undefined
    stubBackup({
      getStatus: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )
    })
    renderCard()

    const placeholder = await screen.findByText(LOADING_TEXT)
    expect(placeholder).toHaveAttribute('data-warning', 'false')
    expect(screen.queryByText('Dernière sauvegarde : jamais')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Supprimer les sauvegardes automatiques (0)' })
    ).toBeDisabled()
    resolveStatus({ success: true, data: { lastBackupAt: null, automaticCount: 0 } })
    expect(await screen.findByText('Dernière sauvegarde : jamais')).toBeInTheDocument()
  })

  it('shows the translated error with a retry when the status fails', async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(failure(ErrorCode.DATABASE_ERROR))
      .mockResolvedValue({ success: true, data: { lastBackupAt: null, automaticCount: 2 } })
    stubBackup({ getStatus })
    renderCard()

    expect(await screen.findByText('Une erreur est survenue')).toBeInTheDocument()
    expect(screen.queryByText('Dernière sauvegarde : jamais')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Dernière sauvegarde : jamais')).toBeInTheDocument()
    expect(getStatus).toHaveBeenCalledTimes(2)
  })

  it('adds a textual cue and a polite live region for a stale backup', async () => {
    const stale = new Date(Date.now() - STALE_BACKUP_DAYS * MS_PER_DAY).toISOString()
    stubBackup({
      getStatus: vi
        .fn()
        .mockResolvedValue({ success: true, data: { lastBackupAt: stale, automaticCount: 0 } })
    })
    renderCard()

    expect(await screen.findByText('sauvegarde conseillée')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('keeps the buttons disabled after a successful restore until the restart', async () => {
    const restore = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { fileName: 'cdi-2026.db' } })
      .mockResolvedValue({ success: true, data: { restored: true } })
    stubBackup({ restore })
    renderCard()
    await findStatus('Dernière sauvegarde : jamais')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurer' }))

    await waitFor(() => expect(restore).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restaurer une sauvegarde…' })).toBeDisabled()
  })
})
