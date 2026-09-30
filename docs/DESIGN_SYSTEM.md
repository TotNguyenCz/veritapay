# VeritaPay — Design System

## 1. Triết lý thiết kế

VeritaPay hướng tới aesthetic **Arc Light / Arc Dark**: sạch, hiện đại, chuyên nghiệp. Không dùng màu neon, không dùng gradient loè loẹt. Mọi màu sắc đều có ý nghĩa ngữ nghĩa — không dùng màu cứng hardcode trừ brand colors và status colors cố định.

**Nguyên tắc:**
- **Semantic tokens first** — component dùng `var(--token)`, không dùng màu hex trực tiếp
- **Glassmorphism nhẹ** — surface mờ với backdrop-blur, không dùng box-shadow nặng
- **Typography hierarchy rõ ràng** — Space Grotesk (display), DM Sans (body), JetBrains Mono (code/numbers)
- **Desktop-first** nhưng responsive xuống mobile

---

## 2. Design Tokens (CSS Custom Properties)

Tất cả tokens được khai báo trên `:root` (light) và `.dark` (dark) trong `src/index.css`.

### Màu nền & surface

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0d1b2f` | Background gốc |
| `--bg-gradient` | Linear gradient xanh nhạt | Linear gradient navy | `body`, trang chính |
| `--surface` | `rgba(255,255,255,0.80)` | `rgba(255,255,255,0.07)` | Glass card |
| `--surface-strong` | `rgba(255,255,255,0.95)` | `rgba(255,255,255,0.11)` | Header, sheet backdrop |
| `--surface-muted` | `#f3f4f8` | `#1a2840` | Tab bar bg, chip inactive |

### Màu chữ

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--ink` | `#111827` | `#f0f4fc` | Text chính, heading |
| `--ink-2` | `#374151` | `#dce8f5` | Text phụ quan trọng |
| `--muted` | `#6b7280` | `#94a3b8` | Label, placeholder |
| `--subtle` | `#9ca3af` | `#64748b` | Helper text, metadata |

### Màu đường viền

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--border` | `rgba(17,24,39,0.10)` | `rgba(255,255,255,0.10)` | Card, input border |
| `--border-strong` | `rgba(17,24,39,0.22)` | `rgba(203,219,242,0.40)` | Divider, scroll thumb |

### Màu accent (brand)

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--accent` | `#122d45` (navy) | `#acc6e9` (xanh nhạt) | Button primary, tab active |
| `--accent-hover` | `#1a4a75` | `#ccddf5` | Hover state của accent |
| `--accent-fg` | `#ffffff` | `#0d1b2f` | Text trên accent bg |

### Màu trạng thái

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--success` | `#16a34a` | `#4ade80` | Settled, success toast |
| `--danger` | `#dc2626` | `#f87171` | Disputed, error, danger |
| `--warning` | `#d97706` | `#fbbf24` | Missed, warning |
| `--focus` | `#93c5fd` | `#3b82f6` | Focus ring |

### Màu score uy tín

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--score-high` | `#16a34a` | `#4ade80` | Score ≥ 80% |
| `--score-mid` | `#d97706` | `#fbbf24` | Score 50–79% |
| `--score-low` | `#dc2626` | `#f87171` | Score < 50% |

### Form / Input

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--input-bg` | `rgba(255,255,255,0.85)` | `rgba(255,255,255,0.07)` | Input background |
| `--input-border` | `rgba(17,24,39,0.18)` | `rgba(255,255,255,0.16)` | Input border |
| `--input-placeholder` | `#9ca3af` | `#64748b` | Placeholder text |
| `--glass-inner-bg` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.05)` | glass-inner panels |

### Overlay

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--overlay` | `rgba(17,24,39,0.35)` | `rgba(0,0,0,0.60)` | Sheet backdrop, modal scrim |

---

## 3. Typography

### Font families

```css
.display { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.03em; }
body      { font-family: 'DM Sans', sans-serif; }
.mono     { font-family: 'JetBrains Mono', Menlo, monospace; }
```

### Scale

| Class | Size | Weight | Dùng cho |
|---|---|---|---|
| `.display text-2xl font-bold` | 24px | 700 | Heading lớn, hero |
| `.display text-lg font-bold` | 18px | 700 | Card title, section heading |
| `text-base font-semibold` | 16px | 600 | Navigation label |
| `text-sm font-medium` | 14px | 500 | Body text, description |
| `text-xs font-semibold` | 12px | 600 | Label, chip, badge |
| `text-xs` | 12px | 400 | Helper text, metadata |
| `.mono text-xs` | 12px | 400 | Address, hash, numbers |

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

Dùng cho: Service card, Subscription card, stat panel.

### Glass Inner

```css
.glass-inner {
  background: var(--glass-inner-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```

Dùng cho: Input groups, sub-panels bên trong card.

### State Pill (`StatePill`)

Badge trạng thái period. Props: `state: 0..5`

| State | Label | Màu |
|---|---|---|
| 0 PENDING | Pending | `var(--muted)` + muted bg |
| 1 ATTESTED | Attested | `var(--warning)` + warning bg |
| 2 SETTLED | Settled | `var(--success)` + success bg |
| 3 DISPUTED | Disputed | `var(--danger)` + danger bg |
| 4 RESOLVED | Resolved | `var(--accent)` + accent bg |
| 5 MISSED | Missed | `var(--muted)` + muted bg |

### Reputation Badge (`ReputationBadge`)

Đọc `getVendorReputation(address)` on-chain. Hiển thị score % với màu `--score-{high/mid/low}`.

### TxButton

Button chính cho transaction actions. Props: `isPending`, `isConfirming`, `isSuccess`, `disabled`, `label`, `fullWidth`.

States: Default → Loading (spinner) → Confirming (spinner) → Success (checkmark, 2s) → Default.

### Theme Toggle (`ThemeToggle`)

Button icon `Sun` / `Moon` trong header. Persist `localStorage.veritapay_theme`. Đọc `prefers-color-scheme` nếu chưa có preference.

---

## 5. Layout

- Max width: `max-w-6xl` (1152px) centered
- Page padding: `px-6`
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Card: `glass-card p-5`
- Header height: `h-14` sticky

---

## 6. UI/UX Guidelines

### Luồng tương tác

- **Destructive actions** (Raise Dispute) luôn có confirm step
- **Transaction pending** hiển thị spinner ngay trong button — không dùng loading overlay toàn trang
- **Success state** giữ 2 giây rồi reset button, sheet tự đóng sau 1.8s
- **Error** dùng `toast.error(message.slice(0, 100))` — không show stacktrace

### Responsive

- Mobile (< 640px): single column, ẩn label trong tab bar (chỉ icon)
- Tablet (640–1024px): 2 columns grid
- Desktop (> 1024px): 3 columns grid, full tab labels

### Bottom sheets

- Dùng cho forms: Register, Subscribe, Attest
- Overlay `var(--overlay)` với `backdrop-blur-sm`
- Spring animation: `damping: 30, stiffness: 300`
- Handle bar ở top của sheet

### Animations

- Framer Motion cho sheet transitions
- `transition-colors` Tailwind cho hover states
- Không dùng animation > 300ms cho interactive feedback
- Theme switch: `transition: background-color 0.2s, color 0.2s` trên `body`

### Accessibility

- Tất cả button có `aria-label` khi không có text
- Focus ring: `outline: 2px solid var(--focus); outline-offset: 2px`
- Contrast ratio tối thiểu 4.5:1 cho text thường, 3:1 cho text lớn
- Keyboard navigation: Tab → Enter/Space cho button, Esc để đóng sheet

---

## 7. Màu cố định (không thay đổi theo theme)

Các giá trị sau là brand / status / visualization colors — **không chuyển thành token**:

| Giá trị | Dùng ở đâu | Lý do giữ nguyên |
|---|---|---|
| `linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)` | SubscribeSheet strip | Brand spectral strip |
| `linear-gradient(90deg, #122d45, #1a4a75)` | Accent gradient | Brand accent |
| Màu score `#16a34a / #d97706 / #dc2626` | ReputationBadge | Semantic status (đã token hóa qua `--score-*`) |
| USDC green | Không dùng | N/A |
