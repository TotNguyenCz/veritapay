# VeritaPay

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

VeritaPay is a performance-attested subscription billing protocol on Arc Testnet. Vendors register API/service listings with on-chain SLA commitments (uptime target, price per period, challenge window). Clients subscribe with a pre-authorized USDC budget. After each billing period, the vendor submits a performance attestation (uptime %, latency p99, error rate). If undisputed within the challenge window, the contract auto-settles USDC proportionally to performance. Missed SLAs reduce payment automatically. Vendor Bayesian reputation is public on-chain.

## Deployed Contracts

| Contract | Chain | Address | Explorer |
|---|---|---|---|
| VeritaPay | Arc Testnet (5042002) | 0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f | https://explorer.testnet.arc.io/address/0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f |

USDC (Arc Testnet): 0x3600000000000000000000000000000000000000

## Backend / Database

- **PostgreSQL** via Docker (`veritapay-pg` container, port 5432, volume `veritapay-pgdata`)
- **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) — schema at `server/db/schema.ts`, migrations in `drizzle/`
- **Backend server** at `server/index.ts` — starts on port 3001 with `bun run server`
  - Runs Drizzle migrations on boot
  - REST API (`server/api.ts`) — endpoints: `/health`, `/stats`, `/services`, `/services/:id`, `/subscriptions/:addr`, `/subscriptions/:id/periods`, `/vendor/:addr/services`, `/vendor/:addr/attestations`
  - On-chain event indexer (`server/indexer.ts`) — polls Arc Testnet every 6s, upserts services/subscriptions/periods/attestations/disputes tables
- **Vite proxy** — `/api/*` → `http://localhost:3001/*` (strip `/api` prefix)
- **Environment vars** — `DATABASE_URL` (user-provided), `ARC_TESTNET_RPC_URL` (appended by setup)

### Starting the full stack

```bash
# Start Postgres (if container stopped after sandbox resume)
docker start veritapay-pg

# Start backend (migrations run automatically on boot)
bun run server

# Start Vite dev server (separate terminal)
bun run dev
```

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
