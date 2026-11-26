export interface ExportWriter {
  write(chunk: string): Promise<void>
  commit(): Promise<void>
  abort(): Promise<void>
}

export interface ExportFileAdapter {
  /** Resolves to null when the user cancels the dialog. */
  pickSavePath(defaultFileName: string): Promise<string | null>
  /** Throws when the target is not writable. */
  openWriter(path: string): Promise<ExportWriter>
}
