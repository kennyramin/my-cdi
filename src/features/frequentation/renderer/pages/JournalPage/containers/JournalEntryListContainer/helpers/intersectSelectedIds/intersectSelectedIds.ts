export function intersectSelectedIds(selectedIds: number[], visibleIds: number[]): number[] {
  const visible = new Set(visibleIds)
  return selectedIds.filter((id) => visible.has(id))
}
