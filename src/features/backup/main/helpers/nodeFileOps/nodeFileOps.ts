import { copyFile, rename, rm } from 'node:fs/promises'
import type { FileOps } from '../../ports'

export const nodeFileOps: FileOps = { copyFile, rename, rm }
