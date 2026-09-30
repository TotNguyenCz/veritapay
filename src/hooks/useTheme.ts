/**
 * useTheme — reads/writes the VeritaPay light/dark theme.
 *
 * The theme is stored on <html class="dark"> (toggled by this hook) and
 * persisted to localStorage under the key "veritapay-theme".
 *
 * An anti-flash inline script in index.html applies the saved class before
 * React hydrates, so there is no light→dark flash on reload.
 */

import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'veritapay-theme'

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return null
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch { /* ignore */ }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialise from what the anti-flash script already applied so there is
    // no mismatch between the DOM class and React state on first render.
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    return getStoredTheme() ?? 'light'
  })

  // Sync system preference changes when no explicit preference is stored
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (!getStoredTheme()) {
        const sys = getSystemTheme()
        setThemeState(sys)
        applyTheme(sys)
      }
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
}
