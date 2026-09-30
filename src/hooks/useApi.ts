/**
 * useApi — lightweight typed fetch hook for the VeritaPay REST API.
 * The Vite dev-server proxy rewrites /api/* → http://localhost:3001/*.
 */

import { useReducer, useEffect, useCallback, useRef } from 'react'

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

  const doFetch = useCallback(async () => {
    if (!path) return
    dispatch({ type: 'start' })
    try {
      const res = await fetch(`/api${path}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(body?.error ?? res.statusText)
      }
      const json = await res.json() as T
      dispatch({ type: 'ok', data: json })
    } catch (e) {
      dispatch({ type: 'err', error: e instanceof Error ? e.message : 'fetch error' })
    }
  }, [path])

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const id = setTimeout(() => { void doFetch() }, 0)
    if (opts?.refreshInterval) {
      timerRef.current = setInterval(() => { void doFetch() }, opts.refreshInterval)
    }
    return () => {
      clearTimeout(id)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [doFetch, opts?.refreshInterval])

  return { data: state.data, loading: state.loading, error: state.error, refetch: doFetch }
}
