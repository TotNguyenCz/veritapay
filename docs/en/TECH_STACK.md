# VeritaPay — Tech Stack

## Frontend

| Component | Library / Version | Notes |
|---|---|---|
| Framework | React 18 | Hooks, functional components |
| Build tool | Vite 6 | HMR, `@` alias → `src/` |
| Language | TypeScript 5 | strict mode |
| Styling | Tailwind CSS 3 | utility-first, `darkMode: 'class'` |
| CSS vars | Custom properties | design tokens on `:root` / `.dark` |
| Web3 | wagmi v2 + viem v2 | EVM hooks and client |
| Wallet UI | ConnectKit | wallet connection modal |
| Animations | Framer Motion | bottom sheets, transitions |
| Icons | lucide-react | consistent line icons |
| Chain icons | @web3icons/react | token / chain logos |
| Toasts | Sonner | `toast.success/error` |
| Queries | @tanstack/react-query | server-state cache |
| Package manager | Bun | replaces npm/npx |

## Backend

| Component | Library / Version | Notes |
|---|---|---|
| Runtime | Bun | server + scripts |
| HTTP framework | Hono | lightweight, typed |
| Database | PostgreSQL | schema `VeritaPay` |
| ORM | Drizzle ORM | type-safe queries |
| DB migration | Drizzle Kit | `bun run db:migrate` |
| DB client | postgres.js (pg) | connection pool |
| Indexer | custom (server/indexer.ts) | polls Arc Testnet every 6s |

## Smart Contracts

| Component | Tool / Version | Notes |
|---|---|---|
| Language | Solidity 0.8.28 | |
| Build / test | Foundry (forge) | `bun run contracts:build` / `bun run contracts:test` |
| Libraries | OpenZeppelin 5 | ReentrancyGuard, SafeERC20 |
| Deploy | Arc Studio deploy_contract | artifact: `contracts/out/VeritaPay.sol/VeritaPay.json` |

## Blockchain

| Parameter | Value |
|---|---|
| Chain | Arc Testnet |
| Chain ID | 5042002 |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.testnet.arc.io` |
| Native gas token | USDC (same pool as ERC-20 USDC) |
| USDC address | `0x3600000000000000000000000000000000000000` |
| USDC decimals (ERC-20) | 6 |
| USDC decimals (native) | 18 |

## Environment Variables

| Variable | Description | Scope |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Server only |
| `VITE_VERITAPAY_ADDRESS` | Deployed contract address | Frontend + Server (`VITE_` prefix) |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy base URL | Server (optional) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy token | Server (optional) |
| `RPC_PROXY_CHAINS` | Chains supported by the proxy | Server (optional) |

> **Rule:** `VITE_` prefix → exposed to the browser. Secret keys must NOT use the `VITE_` prefix.

## Directory Structure

```
/
├── src/
│   ├── App.tsx                  # Composition root, nav, tab routing
│   ├── main.tsx                 # Entry point, providers
│   ├── index.css                # Tailwind + CSS tokens + global styles
│   ├── config.ts                # wagmi config (chains, connectors)
│   ├── veritapay-config.ts      # Contract ABI, address, chain config
│   ├── onchain-facts.ts         # Registry: chains, USDC addresses (DO NOT EDIT)
│   ├── onchain-money.ts         # Amount, parseUsdc, formatUsdc (DO NOT EDIT)
│   ├── onchain-wait.ts          # Transaction state machine (DO NOT EDIT)
│   ├── tracing.ts               # Arc Studio trace capture
│   ├── console-capture.ts       # Arc Studio console capture
│   └── components/
│       ├── LandingHero.tsx
│       ├── ServiceMarketplace.tsx
│       ├── SubscriberDashboard.tsx
│       ├── VendorDashboard.tsx
│       ├── RegisterServiceSheet.tsx
│       ├── SubscribeSheet.tsx
│       ├── AttestSheet.tsx
│       ├── ProtocolStats.tsx
│       ├── ThemeToggle.tsx
│       └── shared/
│           ├── ReputationBadge.tsx
│           ├── StatePill.tsx
│           └── TxButton.tsx
├── server/
│   ├── index.ts                 # Hono app, migrations on boot
│   ├── api.ts                   # REST route handlers
│   ├── indexer.ts               # On-chain event indexer
│   └── db/
│       ├── client.ts            # postgres.js pool, search_path
│       ├── schema.ts            # Drizzle schema (pgSchema 'VeritaPay')
│       ├── migrate.ts           # DDL migration (idempotent)
│       └── seed.ts              # Sample data seeder
├── contracts/
│   ├── VeritaPay.sol            # Core protocol contract
│   ├── test/                    # Foundry unit tests
│   └── out/                    # Compiled artifacts (gitignored)
├── docs/                        # Project documentation
│   ├── *.md                     # Vietnamese docs
│   └── en/                      # English docs
├── scripts/
│   ├── check.sh                 # lint + typecheck
│   └── ...                      # deploy helpers
├── foundry.toml
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## Key Scripts

```bash
# Development
bun run dev                  # Vite dev server (port 5173)
bun run server               # Backend API + indexer (port 3001)

# Contracts
bun run contracts:build      # forge build
bun run contracts:test       # forge test

# Database
bun run db:migrate           # Run DDL migration (idempotent)
bun run db:seed              # Seed sample data

# Quality
bun run check                # lint + typecheck (run before every commit)
bun run lint                 # oxlint only
bun run typecheck            # tsc --noEmit only
```
