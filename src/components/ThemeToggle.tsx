/**
 * ThemeToggle — sun/moon button for the app header.
 *
 * Uses the existing CSS-variable system: no extra state, no context needed.
 * The useTheme hook persists preference to localStorage and toggles
 * <html class="dark"> directly.
 */

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface Props {
  className?: string
}

export function ThemeToggle({ className = '' }: Props) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`relative inline-flex items-center justify-center size-9 rounded-xl transition-all duration-150 hover:scale-[1.07] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 ${className}`}
      style={{
        background: 'var(--glass-inner-bg)',
        border: '1px solid var(--border)',
        color: 'var(--muted)',
      }}
    >
      {isDark
        ? <Sun className="size-4" strokeWidth={2} />
        : <Moon className="size-4" strokeWidth={2} />
      }
    </button>
  )
}
