# VeritaPay — Coding Standards

## 1. Ngôn ngữ & Công cụ

- **TypeScript strict** — `"strict": true` trong `tsconfig.json`. Không dùng `any`, không dùng `as unknown as X`
- **Bun** — runtime và package manager. Không dùng `npm`, `npx`, `node` (trừ Circle CLI)
- **oxlint** — linter (cấu hình trong `.oxlintrc.json`). Không dùng ESLint
- **Prettier** — không cấu hình riêng, format tự động qua IDE
- **Solidity 0.8.28** — contracts. Dùng `forge fmt` để format

---

## 2. Coding Style — TypeScript / React

### Component structure

```tsx
// 1. Imports — external trước, internal sau
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatUsdc } from '@/onchain-money'
import { VERITAPAY_ABI } from '@/veritapay-config'

// 2. Types / interfaces (props trước)
interface Props {
  serviceId: bigint
  onClose: () => void
}

// 3. Helper functions / constants (nếu nhỏ, tách file nếu lớn)
const MAX_BUDGET = 1000

// 4. Component
export function MyComponent({ serviceId, onClose }: Props) {
  // 4a. Hooks (tất cả hooks TRƯỚC early return)
  const { address } = useAccount()
  const [value, setValue] = useState('')

  // 4b. Derived state
  const isValid = value.trim().length > 0

  // 4c. Early return (SAU tất cả hooks)
  if (!address) return null

  // 4d. Handlers
  const handleSubmit = () => { /* ... */ }

  // 4e. Render
  return <div>...</div>
}
```

### Hook rules

- **Tất cả hooks phải được gọi TRƯỚC early return** — vi phạm rules-of-hooks là lỗi build
- Không gọi `Date.now()`, `Math.random()` trong render — dùng helper function module-level hoặc `useRef`
- Không gọi `setState` trực tiếp trong effect body đồng bộ (gây vòng lặp)

### Bigint và USDC

```ts
// SAI — hardcode decimals
const amount = BigInt(value) * 10n ** 6n

// ĐÚNG — dùng onchain-money
import { parseAmount, formatAmount } from '@/onchain-money'
const amount = parseAmount(TARGET_CHAIN_ID, value).raw
const display = formatAmount(TARGET_CHAIN_ID, raw)
```

- **Không bao giờ** hardcode `10n ** 6n` hay `10 ** 6` cho USDC
- Không render `bigint` trực tiếp vào JSX — luôn convert sang `string` hoặc `number` trước
- Khi dùng `bigint && <JSX>`: `0n` là falsy, gây lỗi TS. Dùng `Boolean(expr) ? <JSX> : null`

### Import paths

```ts
// Dùng alias @ (absolute) cho src/
import { parseAmount } from '@/onchain-money'     // ĐÚNG
import { parseAmount } from '../../onchain-money' // SAI
```

### Async & floating promises

```ts
// SAI — floating promise
onClick={() => refetch()}

// ĐÚNG — void nếu không cần await
onClick={() => void refetch()}

// ĐÚNG — async handler
const handleClick = async () => { await refetch() }
```

---

## 3. Quy tắc đặt tên

### TypeScript

| Thứ | Convention | Ví dụ |
|---|---|---|
| Component | PascalCase | `ServiceMarketplace`, `TxButton` |
| Hook | camelCase với prefix `use` | `useApi`, `useTheme` |
| Utility function | camelCase | `formatScorePct`, `nowSec` |
| Constants (module-level) | SCREAMING_SNAKE | `TARGET_CHAIN_ID`, `MAX_RETRIES` |
| Prop interfaces | PascalCase + `Props` suffix | `ServiceCardProps` |
| Types | PascalCase | `PeriodState`, `DbService` |
| CSS classes | kebab-case | `glass-card`, `state-badge` |
| CSS variables | `--kebab-case` | `--surface-muted`, `--border-strong` |
| Files (component) | PascalCase.tsx | `ServiceMarketplace.tsx` |
| Files (hook/util) | camelCase.ts | `useApi.ts`, `nowSec.ts` |

### Solidity

| Thứ | Convention | Ví dụ |
|---|---|---|
| Contract | PascalCase | `VeritaPay` |
| Function (public) | camelCase | `registerService`, `getSubscription` |
| State variable | camelCase | `vendorStats`, `serviceCounter` |
| Struct | PascalCase | `ServiceListing`, `Period` |
| Enum | PascalCase | `PeriodState` |
| Event | PascalCase | `ServiceRegistered`, `PaymentSettled` |
| Error | PascalCase | `Unauthorized`, `ServiceNotFound` |
| Constant | SCREAMING_SNAKE | `LAPLACE_K`, `BASIS_POINTS` |
| Private variable | `_camelCase` | `_removeActiveSubscription` |

### Database (Drizzle)

| Thứ | Convention | Ví dụ |
|---|---|---|
| Table (Drizzle) | camelCase | `services`, `subscriptions` |
| Column | snake_case | `service_id`, `created_at` |
| DB schema | `VeritaPay` | (PascalCase vì user đặt) |

---

## 4. Coding Rules

### Frontend

1. **Không import `onchain-facts.ts`, `onchain-money.ts`, `onchain-wait.ts` rồi đọc giá trị hardcode** — các file này là nguồn sự thật duy nhất
2. **Không dùng `localStorage` trực tiếp** ngoài `ThemeProvider` — state quản lý qua React state
3. **Không dùng `document.getElementById`** trong component — dùng React refs
4. **Không thêm `console.log`** vào production code (trừ `console.error` cho lỗi thực sự)
5. **Không dùng inline style** khi có CSS variable hoặc Tailwind class tương đương
6. **Không hardcode địa chỉ contract hoặc RPC URL** — đọc từ `veritapay-config.ts` và `.env`
7. **Không đặt secret vào `VITE_` prefix** — secret chỉ đọc từ `process.env` phía server

### Smart Contracts

1. **Reentrancy guard** — tất cả function có external call phải dùng `nonReentrant`
2. **Check-Effects-Interactions** — update state TRƯỚC khi gọi external contract
3. **Không dùng `transfer()` hay `send()`** — dùng `SafeERC20.safeTransfer`
4. **Custom errors** — dùng `error Foo()` thay vì `require(cond, "string")`
5. **Events cho mọi state change quan trọng** — indexer dựa vào events
6. **Không dùng `block.timestamp` cho randomness** — chỉ dùng cho thời hạn (acceptable)
7. **Không để unbounded loop trên storage array** — dùng mapping + counter

### Backend

1. **Tất cả DB query dùng Drizzle ORM** — không raw SQL trừ DDL migration
2. **Search path** `VeritaPay` phải được set trong client connection
3. **Backend khởi động với `bun`** — không dùng `node` (Bun auto-load `.env`)
4. **Indexer catchup** — không scan từ block 0 mỗi lần; dùng `indexer_cursors` để lưu last block

---

## 5. Patterns

### API fetch với `useApi`

```ts
import { useApi } from '@/hooks/useApi'

const { data, loading, error, refetch } = useApi<DbService[]>('/services')
```

- Không dùng `fetch` trực tiếp trong component
- `refetch` trả về `Promise<void>` — dùng `void refetch()` trong onClick

### Transaction flow

```ts
const { writeContract, data: hash, isPending } = useWriteContract()
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

// Trong handler:
writeContract(
  { address, abi, functionName, args, chainId },
  {
    onSuccess: () => { toast.success('Done'); setTimeout(onClose, 1800) },
    onError: (e) => toast.error('Failed: ' + e.message.slice(0, 100)),
  }
)

// Trong render:
<TxButton
  onClick={handler}
  isPending={isPending}
  isConfirming={isConfirming}
  isSuccess={isSuccess}
  disabled={!valid}
  label="Register"
/>
```

### Theme-aware styles

```tsx
// ĐÚNG — dùng token
<div style={{ background: 'var(--surface)', color: 'var(--ink)' }}>

// SAI — hardcode
<div style={{ background: 'rgba(255,255,255,0.8)', color: '#111827' }}>

// ĐÚNG — Tailwind (với darkMode:class)
<div className="bg-white dark:bg-navy-900 text-gray-900 dark:text-gray-100">

// Ưu tiên CSS variables hơn Tailwind dark: prefix cho consistency
```
