import type { IpcMain } from 'electron'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { FrequentationGatewayDrizzle } from './gateways/frequentation'
import { registerFrequentationController } from './controllers/frequentation'

export function initializeFrequentationModule(
  db: BetterSQLite3Database<Record<string, unknown>>,
  ipcMain: IpcMain
): FrequentationGatewayDrizzle {
  const frequentationGateway = new FrequentationGatewayDrizzle(db)
  registerFrequentationController(ipcMain, frequentationGateway)
  return frequentationGateway
}

export { FrequentationGatewayDrizzle }
