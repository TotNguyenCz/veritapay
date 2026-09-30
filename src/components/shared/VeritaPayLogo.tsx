/**
 * VeritaPay Logo — custom SVG mark.
 *
 * Design concept: "Verified Signal"
 * - A bold V-checkmark (Veritas = truth/attestation) whose right stroke
 *   extends into a circular arc that closes the loop — representing the
 *   automated payment settlement cycle.
 * - The arc is open at top-right, creating a sense of forward motion
 *   (signal received → payment triggered).
 * - Two concentric dots at the arc terminus suggest an on-chain event /
 *   block confirmation.
 * - Proportions are optically balanced at 28px, 32px, 48px, and 96px.
 * - Works on both light (dark ink) and dark (pale blue) backgrounds
 *   via currentColor + CSS variable fills.
 *
 * Usage:
 *   <VeritaPayLogo size={32} />            — monochrome, inherits color
 *   <VeritaPayLogo size={32} variant="color" />  — brand palette
 */

interface Props {
  size?: number
  variant?: 'mono' | 'color'
  className?: string
}

export function VeritaPayLogo({ size = 32, variant = 'color', className }: Props) {
  const mono = variant === 'mono'

  // Brand palette
  const inkDeep   = mono ? 'currentColor' : 'var(--accent)'
  const inkMid    = mono ? 'currentColor' : 'var(--accent-hover)'
  const dotOuter  = mono ? 'currentColor' : 'var(--accent)'
  const dotInner  = mono ? 'var(--accent-fg)' : 'var(--accent-fg)'
  const arcStroke = mono ? 'currentColor' : 'var(--accent)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="VeritaPay"
      role="img"
    >
      {/*
        ── MARK GEOMETRY ──────────────────────────────────────────────────
        Coordinate system: 40×40 viewport.

        The V-checkmark:
          Left arm:  (6, 14) → (15, 27)
          Right arm: (15, 27) → transitions into a circular arc

        The arc:
          Origin at checkmark apex (15, 27).
          Sweeps clockwise from ~220° to ~50°, radius ≈ 13.5,
          centre at (26, 16) — naturally sits top-right of the mark.
          Arc is open at top (gap = visual "signal in flight").

        Confirmation dot: sits at arc terminus (31.5, 9.5).
        Inner dot: 2px white/light fill for depth.
      */}

      {/* ── Outer arc (open circle, clockwise 210° sweep) ── */}
      <path
        d="M15.5 26.5
           A 13.5 13.5 0 1 1 32.2 10.8"
        stroke={arcStroke}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.28"
      />

      {/* ── V-checkmark left arm ── */}
      <path
        d="M6 13 L15.5 26.5"
        stroke={inkDeep}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* ── V-checkmark right arm (continues into arc tangentially) ── */}
      <path
        d="M15.5 26.5 L32.2 10.8"
        stroke={inkMid}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* ── Confirmation dot — outer ring ── */}
      <circle cx="32.2" cy="10.8" r="3.6" fill={dotOuter} />

      {/* ── Confirmation dot — inner fill (depth) ── */}
      <circle cx="32.2" cy="10.8" r="1.6" fill={dotInner} />
    </svg>
  )
}

/**
 * Full lockup: mark + wordmark, horizontal.
 * Use in headers, footers, and the landing hero.
 */
interface LockupProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'mono' | 'color'
  className?: string
}

const SIZES = {
  sm: { mark: 22, text: 'text-sm',  gap: 'gap-2',   tracking: 'tracking-[-0.025em]' },
  md: { mark: 28, text: 'text-base', gap: 'gap-2.5', tracking: 'tracking-[-0.03em]' },
  lg: { mark: 40, text: 'text-2xl', gap: 'gap-3',   tracking: 'tracking-[-0.04em]' },
}

export function VeritaPayLockup({ size = 'md', variant = 'color', className }: LockupProps) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center ${s.gap} ${className ?? ''}`}>
      <VeritaPayLogo size={s.mark} variant={variant} />
      <span
        className={`display font-bold ${s.text} ${s.tracking}`}
        style={{ color: 'var(--ink)' }}
      >
        Verita<span style={{ color: 'var(--accent)' }}>Pay</span>
      </span>
    </span>
  )
}
