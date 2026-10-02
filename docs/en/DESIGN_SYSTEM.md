# VeritaPay — Design System

## 1. Design Philosophy

VeritaPay targets an **Arc Light / Arc Dark** aesthetic: clean, modern, professional. No neon colors, no garish gradients. Every color has semantic meaning — no hardcoded hex values except fixed brand and status colors.

**Principles:**
- **Semantic tokens first** — components use `var(--token)`, never direct hex values
- **Subtle glassmorphism** — frosted surfaces with backdrop-blur, no heavy box-shadows
- **Clear typography hierarchy** — Space Grotesk (display), DM Sans (body), JetBrains Mono (code/numbers)
- **Desktop-first** but responsive down to mobile

---

## 2. Design Tokens (CSS Custom Properties)

All tokens are declared on `:root` (light) and `.dark` (dark) in `src/index.css`.

### Background & Surface

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0d1b2f` | Root background |
| `--bg-gradient` | Light blue linear gradient | Navy linear gradient | `body`, main pages |
| `--surface` | `rgba(255,255,255,0.80)` | `rgba(255,255,255,0.07)` | Glass card |
| `--surface-strong` | `rgba(255,255,255,0.95)` | `rgba(255,255,255,0.11)` | Header, sheet backdrop |
| `--surface-muted` | `#f3f4f8` | `#1a2840` | Tab bar bg, inactive chips |

### Text Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ink` | `#111827` | `#f0f4fc` | Primary text, headings |
| `--ink-2` | `#374151` | `#dce8f5` | Important secondary text |
| `--muted` | `#6b7280` | `#94a3b8` | Labels, placeholders |
| `--subtle` | `#9ca3af` | `#64748b` | Helper text, metadata |

### Border Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--border` | `rgba(17,24,39,0.10)` | `rgba(255,255,255,0.10)` | Card, input borders |
| `--border-strong` | `rgba(17,24,39,0.22)` | `rgba(203,219,242,0.40)` | Dividers, scroll thumbs |

### Accent (Brand) Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--accent` | `#122d45` (navy) | `#acc6e9` (light blue) | Primary button, active tab |
| `--accent-hover` | `#1a4a75` | `#ccddf5` | Accent hover state |
| `--accent-fg` | `#ffffff` | `#0d1b2f` | Text on accent background |

### Status Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--success` | `#16a34a` | `#4ade80` | Settled, success toasts |
| `--danger` | `#dc2626` | `#f87171` | Disputed, errors, danger |
| `--warning` | `#d97706` | `#fbbf24` | Missed, warnings |
| `--focus` | `#93c5fd` | `#3b82f6` | Focus ring |

### Reputation Score Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--score-high` | `#16a34a` | `#4ade80` | Score ≥ 80% |
| `--score-mid` | `#d97706` | `#fbbf24` | Score 50–79% |
| `--score-low` | `#dc2626` | `#f87171` | Score < 50% |

### Form / Input

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--input-bg` | `rgba(255,255,255,0.85)` | `rgba(255,255,255,0.07)` | Input background |
| `--input-border` | `rgba(17,24,39,0.18)` | `rgba(255,255,255,0.16)` | Input border |
| `--input-placeholder` | `#9ca3af` | `#64748b` | Placeholder text |
| `--glass-inner-bg` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.05)` | glass-inner panels |

### Overlay

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--overlay` | `rgba(17,24,39,0.35)` | `rgba(0,0,0,0.60)` | Sheet backdrops, modal scrims |

---

## 3. Typography

### Font Families

```css
.display { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.03em; }
body      { font-family: 'DM Sans', sans-serif; }
.mono     { font-family: 'JetBrains Mono', Menlo, monospace; }
```

### Scale

| Class | Size | Weight | Used for |
|---|---|---|---|
| `.display text-2xl font-bold` | 24px | 700 | Large headings, hero |
| `.display text-lg font-bold` | 18px | 700 | Card titles, section headings |
| `text-base font-semibold` | 16px | 600 | Navigation labels |
| `text-sm font-medium` | 14px | 500 | Body text, descriptions |
| `text-xs font-semibold` | 12px | 600 | Labels, chips, badges |
| `text-xs` | 12px | 400 | Helper text, metadata |
| `.mono text-xs` | 12px | 400 | Addresses, hashes, numbers |

---

## 4. Component Library

### Glass Card

```css
.glass-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  backdrop-filter: blur(20px) saturate(160%);
}
```

Used for: Service cards, Subscription cards, stat panels.

### Glass Inner

```css
.glass-inner {
  background: var(--glass-inner-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```

Used for: Input groups, sub-panels inside cards.

### State Pill (`StatePill`)

Period state badge. Props: `state: 0..5`

| State | Label | Color |
|---|---|---|
| 0 PENDING | Pending | `var(--muted)` + muted bg |
| 1 ATTESTED | Attested | `var(--warning)` + warning bg |
| 2 SETTLED | Settled | `var(--success)` + success bg |
| 3 DISPUTED | Disputed | `var(--danger)` + danger bg |
| 4 RESOLVED | Resolved | `var(--accent)` + accent bg |
| 5 MISSED | Missed | `var(--muted)` + muted bg |

### Reputation Badge (`ReputationBadge`)

Reads `getVendorReputation(address)` on-chain. Displays score % with `--score-{high/mid/low}` color.

### TxButton

Primary button for transaction actions. Props: `isPending`, `isConfirming`, `isSuccess`, `disabled`, `label`, `fullWidth`.

States: Default → Loading (spinner) → Confirming (spinner) → Success (checkmark, 2s) → Default.

### Theme Toggle (`ThemeToggle`)

`Sun` / `Moon` icon button in the header. Persists to `localStorage.veritapay_theme`. Reads `prefers-color-scheme` if no preference is stored.

---

## 5. Layout

- Max width: `max-w-6xl` (1152px) centered
- Page padding: `px-6`
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Card: `glass-card p-5`
- Header height: `h-14` sticky

---

## 6. UI/UX Guidelines

### Interaction Flows

- **Destructive actions** (Raise Dispute) always require a confirmation step
- **Transaction pending** shows a spinner directly in the button — no full-page loading overlay
- **Success state** holds for 2 seconds then resets the button; the sheet closes after 1.8s
- **Errors** use `toast.error(message.slice(0, 100))` — no stack traces shown

### Responsive Breakpoints

- Mobile (< 640px): single column, tab bar shows icons only (labels hidden)
- Tablet (640–1024px): 2-column grid
- Desktop (> 1024px): 3-column grid, full tab labels

### Bottom Sheets

- Used for forms: Register, Subscribe, Attest
- Overlay: `var(--overlay)` with `backdrop-blur-sm`
- Spring animation: `damping: 30, stiffness: 300`
- Handle bar at the top of the sheet

### Animations

- Prefer `transition-all duration-200` for simple state transitions
- Use Framer Motion `AnimatePresence` only for sheet mount/unmount
- No decorative animations — motion must communicate state or guide attention

### Icon Usage

- `lucide-react` for all UI icons — consistent stroke width
- Size classes: `size-3`, `size-3.5`, `size-4`, `size-5` (never px values)
- Icon-only buttons must have `aria-label`

---

## 7. Fixed Colors (Not Tokenized)

These values are intentionally hardcoded and should not be converted to tokens:

| Value | Used for | Reason |
|---|---|---|
| `rgba(22,163,74,0.14)` | "Deployed" badge background | One-off status badge |
| `rgba(217,119,6,0.12)` | "Not deployed" warning pill | One-off status badge |
| `rgba(59,130,246,0.08)` | Info box background in sheets | Low-priority info surface |
| Score gradient strip | AttestSheet spectral bar | Data visualization, not UI chrome |
