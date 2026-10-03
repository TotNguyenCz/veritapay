/**
 * ApiCacheContext — global registry for useApi refetch callbacks.
 * useRefreshAll calls flushApiCache() to trigger all active useApi instances
 * to refetch immediately after a transaction is confirmed.
 */

const listeners = new Set<() => void>()

export function registerApiListener(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function flushApiCache(): void {
  listeners.forEach((fn) => fn())
}
