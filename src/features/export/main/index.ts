import type { IpcMain } from 'electron'
import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import { registerExportController } from './controllers/export'
import type { ExportFileAdapter } from './ports'

export function initializeExportModule(
  ipcMain: IpcMain,
  frequentationGateway: FrequentationGateway,
  studentGateway: StudentGateway,
  fileAdapter: ExportFileAdapter
): void {
  registerExportController(ipcMain, { frequentationGateway, studentGateway, fileAdapter })
}
