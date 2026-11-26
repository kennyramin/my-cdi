import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { UseCaseResult } from '@lib/use-case'
import { formatLocalDateTime } from '@lib/localDateTime'

export const CLEANUP_RETENTION_YEARS = 2

export interface CleanupResult {
  deletedCount: number
}

export function buildRetentionCutoff(now: Date): string {
  const cutoff = new Date(now)
  cutoff.setFullYear(cutoff.getFullYear() - CLEANUP_RETENTION_YEARS)
  return formatLocalDateTime(cutoff)
}

export async function cleanupOldFrequentations(
  gateway: FrequentationGateway,
  now: Date = new Date()
): Promise<UseCaseResult<CleanupResult>> {
  try {
    const deletedCount = await gateway.deleteOlderThan(buildRetentionCutoff(now))
    return { success: true, data: { deletedCount } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
