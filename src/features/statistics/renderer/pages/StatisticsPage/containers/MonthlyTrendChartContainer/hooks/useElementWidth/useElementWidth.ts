import { useEffect, useState } from 'react'

export function useElementWidth<T extends Element>(fallbackWidth: number) {
  const [node, setNode] = useState<T | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const next = entry ? Math.round(entry.contentRect.width) : 0
      if (next > 0) {
        setMeasuredWidth(next)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return { ref: setNode, width: measuredWidth > 0 ? measuredWidth : fallbackWidth }
}
