# VeritaPay — Coding Standards

## 1. Language & Tooling

- **TypeScript strict** — `"strict": true` in `tsconfig.json`. No `any`, no `as unknown as X`
- **Bun** — runtime and package manager. Do not use `npm`, `npx`, or `node` (except for the Circle CLI)
- **oxlint** — linter (configured in `.oxlintrc.json`). Do not use ESLint
- **Prettier** — no custom config; auto-formatted via IDE
- **Solidity 0.8.28** — contracts. Use `forge fmt` to format

---

## 2. Coding Style — TypeScript / React

### Component Structure

```tsx
// 1. Imports — external first, then internal
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatUsdc } from '@/onchain-money'
import { VERITAPAY_ABI } from '@/veritapay-config'

// 2. Types / interfaces (props first)
interface Props {
  serviceId: bigint
  onClose: () => void
}

// 3. Helper functions / constants (small ones here, extract to a file if large)
const MAX_BUDGET = 1000

// 4. Component
export function MyComponent({ serviceId, onClose }: Props) {
  // 4a. Hooks (ALL hooks BEFORE any early return)
  const { address } = useAccount()
  const [value, setValue] = useState('')

  // 4b. Derived state
  const isValid = value.trim().length > 0

  // 4c. Early return (AFTER all hooks)
  if (!address) return null

  // 4d. Handlers
  const handleSubmit = () => { /* ... */ }

  // 4e. Render
  return <div>...</div>
}
```

### Hook Rules

- **All hooks must be called BEFORE any early return** — violating rules-of-hooks is a build error
- Do not call `Date.now()` or `Math.random()` in the render body — use a module-level helper function or `useRef`
- Do not call `setState` directly inside a synchronous effect body (causes infinite loops)

### Bigint and USDC

```ts
// WRONG — hardcoded decimals
const amount = BigInt(value) * 10n ** 6n

// CORRECT — use onchain-money
import { parseAmount, formatAmount } from '@/onchain-money'
const amount = parseAmount(TARGET_CHAIN_ID, value).raw
const display = formatAmount(TARGET_CHAIN_ID, raw)
```

- **Never** hardcode `10n ** 6n` or `10 ** 6` for USDC
- Do not render `bigint` directly into JSX — always convert to `string` or `number` first
- When using `bigint && <JSX>`: `0n` is falsy, which causes a TypeScript error. Use `Boolean(expr) ? <JSX> : null`

### Import Paths

```ts
// Use @ alias (absolute) for src/
import { parseAmount } from '@/onchain-money'     // CORRECT
import { parseAmount } from '../../onchain-money' // WRONG
```

### Async & Floating Promises

```ts
// WRONG — floating promise
onClick={() => refetch()}

// CORRECT — void if no await needed
onClick={() => void refetch()}

// CORRECT — async handler
const handleClick = async () => { await refetch() }
```

---

## 3. Naming Conventions

### TypeScript

| What | Convention | Example |
|---|---|---|
| Component | PascalCase | `ServiceMarketplace`, `TxButton` |
| Hook | camelCase with `use` prefix | `useApi`, `useTheme` |
| Utility function | camelCase | `formatScorePct`, `nowSec` |
| Module-level constants | SCREAMING_SNAKE | `TARGET_CHAIN_ID`, `MAX_RETRIES` |
| Prop interfaces | PascalCase + `Props` suffix | `ServiceCardProps` |
| Types | PascalCase | `PeriodState`, `DbService` |
| CSS classes | kebab-case | `glass-card`, `state-badge` |
| CSS variables | `--kebab-case` | `--surface-muted`, `--border-strong` |
| Component files | PascalCase.tsx | `ServiceMarketplace.tsx` |
| Hook/util files | camelCase.ts | `useApi.ts`, `nowSec.ts` |

### Solidity

| What | Convention | Example |
|---|---|---|
| Contract | PascalCase | `VeritaPay` |
| Public function | camelCase | `registerService`, `getSubscription` |
| State variable | camelCase | `vendorStats`, `serviceCounter` |
| Struct | PascalCase | `ServiceListing`, `Period` |
| Enum | PascalCase | `PeriodState` |
| Event | PascalCase | `ServiceRegistered`, `PaymentSettled` |
| Error | PascalCase | `Unauthorized`, `ServiceNotFound` |
| Constant | SCREAMING_SNAKE | `LAPLACE_K`, `BASIS_POINTS` |
| Private variable | `_camelCase` | `_removeActiveSubscription` |

### Database (Drizzle)

| What | Convention | Example |
|---|---|---|
| Table (Drizzle) | camelCase | `services`, `subscriptions` |
| Column | snake_case | `service_id`, `created_at` |
| DB schema | `VeritaPay` | (PascalCase, user-defined) |

---

## 4. Coding Rules

### Frontend

1. **Do not import `onchain-facts.ts`, `onchain-money.ts`, `onchain-wait.ts` and read hardcoded values** — these files are the single source of truth
2. **Do not use `localStorage` directly** outside of `ThemeProvider` — state is managed through React state
3. **Do not use `document.getElementById`** in components — use React refs
4. **Do not add `console.log`** to production code (except `console.error` for real errors)
5. **Do not use inline styles** when a CSS variable or Tailwind class covers the case
6. **Do not hardcode contract addresses or RPC URLs** — read from `veritapay-config.ts` and `.env`
7. **Do not put secrets in `VITE_` prefix** — secrets are only read from `process.env` on the server side

### Smart Contracts

1. **Reentrancy guard** — all functions with external calls must use `nonReentrant`
2. **Check-Effects-Interactions** — update state BEFORE calling external contracts
3. **Do not use `transfer()` or `send()`** — use `SafeERC20.safeTransfer`
4. **Custom errors** — use `error Foo()` instead of `require(cond, "string")`
5. **Events for every important state change** — the indexer relies on events
6. **Do not use `block.timestamp` for randomness** — only use for deadlines (acceptable)
7. **No unbounded loops over storage arrays** — use mappings + counters

### Backend

1. **All DB queries use Drizzle ORM** — no raw SQL except in DDL migrations
2. **Search path** `VeritaPay` must be set in the client connection
3. **Start the backend with `bun`** — do not use `node` (Bun auto-loads `.env`)
4. **Indexer catchup** — do not scan from block 0 on every restart; use `indexer_cursors` to store the last block

---

## 5. Patterns

### API Fetch with `useApi`

```ts
import { useApi } from '@/hooks/useApi'

const { data, loading, error, refetch } = useApi<DbService[]>('/services')
```

- Do not call `fetch` directly inside a component
- `refetch` returns `Promise<void>` — use `void refetch()` in onClick handlers

### Transaction Flow

```ts
const { writeContract, data: hash, isPending } = useWriteContract()
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

// In the handler:
writeContract(
  { address, abi, functionName, args, chainId },
  {
    onSuccess: () => { toast.success('Done'); setTimeout(onClose, 1800) },
    onError: (e) => toast.error('Failed: ' + e.message.slice(0, 100)),
  }
)

// In the render:
<TxButton
  onClick={handler}
  isPending={isPending}
  isConfirming={isConfirming}
  isSuccess={isSuccess}
  label="Submit Attestation"
/>
```

### Theme-Aware Styles

```tsx
// Prefer CSS variables (automatically adapts to theme)
<div style={{ background: 'var(--surface)', color: 'var(--ink)' }}>

// Use dark: Tailwind variants only for one-off overrides
<div className="border dark:border-white/10">
```
