/**
 * useApi — lightweight typed fetch hook for the VeritaPay REST API.
 * The Vite dev-server proxy rewrites /api/* → http://localhost:3001/*.
 *
 * M-02 fix: AbortController cancels in-flight requests when path changes or
 * component unmounts, preventing stale responses from overwriting newer data.
 */

import { useReducer, useEffect, useCallback, useRef } from 'react'
import { registerApiListener } from './useApiCache'

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

type Action<T> =
  | { type: 'start' }
  | { type: 'ok'; data: T }
  | { type: 'err'; error: string }

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'start': return { ...state, loading: true, error: null }
    case 'ok':    return { data: action.data, loading: false, error: null }
    case 'err':   return { ...state, loading: false, error: action.error }
  }
}

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApi<T>(
  path: string | null,
  opts?: { refreshInterval?: number },
): ApiState<T> {
  const [state, dispatch] = useReducer(reducer<T>, { data: null, loading: false, error: null })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // M-02 fix: track current AbortController so stale responses are discarded
  const abortRef = useRef<AbortController | null>(null)

  const doFetch = useCallback(async () => {
    if (!path) return

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    dispatch({ type: 'start' })
    try {
      const res = await fetch(`/api${path}`, { signal: controller.signal })
      // If this request was aborted, ignore the result
      if (controller.signal.aborted) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(body?.error ?? res.statusText)
      }
      const json = await res.json() as T
      if (!controller.signal.aborted) {
        dispatch({ type: 'ok', data: json })
      }
    } catch (e) {
      // DOMException with name 'AbortError' means the request was intentionally cancelled
      if (e instanceof DOMException && e.name === 'AbortError') return
      dispatch({ type: 'err', error: e instanceof Error ? e.message : 'fetch error' })
    }
  }, [path])

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const id = setTimeout(() => { void doFetch() }, 0)
    if (opts?.refreshInterval) {
      timerRef.current = setInterval(() => { void doFetch() }, opts.refreshInterval)
    }
    // Register with global API cache so useRefreshAll can trigger immediate refetch
    const unregister = registerApiListener(() => { void doFetch() })
    return () => {
      clearTimeout(id)
      if (timerRef.current) clearInterval(timerRef.current)
      abortRef.current?.abort()
      unregister()
    }
  }, [doFetch, opts?.refreshInterval])

  return { data: state.data, loading: state.loading, error: state.error, refetch: doFetch }
}
