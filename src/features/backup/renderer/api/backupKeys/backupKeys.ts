export const backupKeys = {
  all: ['backup'] as const,
  status: () => [...backupKeys.all, 'status'] as const
}
