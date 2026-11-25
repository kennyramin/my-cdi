import type { ClassCountDto } from '@statistics-shared'

export interface ClassBar {
  classe: string
  count: number
  widthPercent: number
}

export const MAX_CLASS_BARS = 10
export const MIN_BAR_PERCENT = 2
const PERCENT = 100
const CLASS_COLLATOR = new Intl.Collator('fr', { numeric: true })

function toWidthPercent(count: number, topCount: number): number {
  if (topCount <= 0 || count <= 0) {
    return 0
  }
  return Math.max(MIN_BAR_PERCENT, Math.round((count / topCount) * PERCENT))
}

export function buildClassBars(classCounts: ClassCountDto[]): ClassBar[] {
  const top = [...classCounts]
    .sort((a, b) => b.count - a.count || CLASS_COLLATOR.compare(a.classe, b.classe))
    .slice(0, MAX_CLASS_BARS)
  const topCount = top[0]?.count ?? 0
  return top.map(({ classe, count }) => ({
    classe,
    count,
    widthPercent: toWidthPercent(count, topCount)
  }))
}
