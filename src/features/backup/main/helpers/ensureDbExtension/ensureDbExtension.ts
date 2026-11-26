const DB_EXTENSION = '.db'

export function ensureDbExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith(DB_EXTENSION) ? filePath : `${filePath}${DB_EXTENSION}`
}
