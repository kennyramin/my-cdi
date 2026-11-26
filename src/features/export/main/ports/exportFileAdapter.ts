export interface ExportWriter {
  write(chunk: string): Promise<void>
  commit(): Promise<void>
  abort(): Promise<void>
}

export interface ExportFileAdapter {
  /** Resolves to null when the user cancels the dialog. */
  pickSavePath(defaultFileName: string): Promise<string | null>
  /**
   * Throws when the target is not writable; a throwing call leaves no temp file or open handle
   * (runExport does not call abort in that case). Writers stage into a temp file in the TARGET
   * directory (same filesystem) under an unpredictable name, never the final name, and never write
   * outside the chosen path. commit() flushes and closes the handle BEFORE renaming, and an
   * existing target stays untouched until the rename succeeds. abort() must work after a failed
   * write AND after a failed commit(): close the handle, delete the temp file, never throw, and be
   * idempotent (a second call is a no-op).
   */
  openWriter(path: string): Promise<ExportWriter>
}
