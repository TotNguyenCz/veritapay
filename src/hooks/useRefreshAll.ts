/**
 * useRefreshAll — invalidates all wagmi contract-read cache entries
 * so every useReadContract / useReadContracts in the tree refetches.
 *
 * Call invalidate() in the onSuccess callback of any write transaction
 * to make the UI reflect the new chain state immediately.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function useRefreshAll() {
  const qc = useQueryClient()

  const invalidate = useCallback(() => {
    // wagmi v2 stores read queries under the 'readContract' queryKey type.
    // Invalidating all queries that contain 'readContract' / 'readContracts'
    // makes every useReadContract hook refetch without needing explicit refs.
    void qc.invalidateQueries({ predicate: (q) => {
      const key = q.queryKey
      if (!Array.isArray(key)) return false
      const first = key[0]
      // wagmi v2 query keys: [{ type, ... }]
      if (typeof first === 'object' && first !== null) {
        const t = (first as { type?: string }).type ?? ''
        return t === 'readContract' || t === 'readContracts' || t === 'balance'
      }
      return false
    }})
  }, [qc])

  return invalidate
}
