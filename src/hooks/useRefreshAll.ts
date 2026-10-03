/**
 * useRefreshAll — invalidates all wagmi contract-read cache entries
 * so every useReadContract / useReadContracts in the tree refetches.
 *
 * Call invalidate() in the onSuccess callback of any write transaction
 * to make the UI reflect the new chain state immediately.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { flushApiCache } from './useApiCache'

export function useRefreshAll() {
  const qc = useQueryClient()

  const invalidate = useCallback(() => {
    // 1. Invalidate all wagmi contract-read cache entries
    void qc.invalidateQueries({ predicate: (q) => {
      const key = q.queryKey
      if (!Array.isArray(key)) return false
      const first = key[0]
      if (typeof first === 'object' && first !== null) {
        const t = (first as { type?: string }).type ?? ''
        return t === 'readContract' || t === 'readContracts' || t === 'balance'
      }
      return false
    }})
    // 2. Flush all active useApi listeners (ProtocolStats, DB-backed lists)
    flushApiCache()
  }, [qc])

  return invalidate
}
