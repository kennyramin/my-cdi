import type { IpcMain } from 'electron'
import { StudentGatewayDrizzle, type StudentDb } from './gateways/student'
import { registerStudentController } from './controllers/student'

export interface StudentModuleDeps {
  createAutomaticBackup: (reason: 'anonymization') => Promise<string>
}

export function initializeStudentModule(
  db: StudentDb,
  ipcMain: IpcMain,
  deps: StudentModuleDeps
): StudentGatewayDrizzle {
  const studentGateway = new StudentGatewayDrizzle(db)
  registerStudentController(ipcMain, studentGateway, deps.createAutomaticBackup)
  return studentGateway
}

export { StudentGatewayDrizzle }
