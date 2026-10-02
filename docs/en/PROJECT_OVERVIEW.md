# VeritaPay — Project Overview

## 1. Goals

VeritaPay is a **performance-attested subscription billing protocol** running on Arc Testnet. It solves the enterprise SLA billing problem: instead of manual invoices, email confirmations, and 30–90 day reconciliation cycles, VeritaPay automates the entire payment lifecycle via smart contract — **no escrow, no trusted third party required**.

**Core objectives:**
- Vendors register services with on-chain SLA commitments (target uptime, price per period, challenge window)
- Subscribers enroll with a pre-authorized USDC budget (no upfront capital lock)
- After each billing period, vendors submit a signed performance attestation (uptime %, latency p99, error rate)
- If unchallenged within the defined window, the contract auto-settles USDC proportional to actual vs. target performance
- A Bayesian vendor reputation score is published publicly on-chain

---

## 2. Features

| # | Feature | Status |
|---|---|---|
| F-01 | Service Marketplace | Done |
| F-02 | Service Registration (vendor) | Done |
| F-03 | Subscribe to Service (USDC approve + subscribe) | Done |
| F-04 | Subscription Management (subscriber dashboard) | Done |
| F-05 | Submit Attestation (vendor) | Done |
| F-06 | Raise / Resolve Dispute | Done |
| F-07 | Vendor On-chain Reputation Score | Done |
| F-08 | Full Period History from DB | Done |
| F-09 | Protocol Stats Bar | Done |
| F-10 | Light / Dark Theme | In Progress |
| F-11 | Project Documentation | In Progress |

---

## 3. Feature Descriptions

### F-01 Service Marketplace

Displays all registered services on VeritaPay, loaded from the DB (instead of per-card RPC calls). Each card shows:
- Service name, vendor address (truncated)
- Price per period (USDC), period length, target uptime SLA
- On-chain reputation badge (Bayesian score, honored/total periods)
- Total subscribers and USDC settled from the DB
- "Subscribe" button opening the SubscribeSheet

**Data source:** `/api/services` (DB) + `getVendorReputation` (on-chain read per card)

### F-02 Service Registration (Vendor)

Bottom sheet allowing vendors to register new services:
- Name, metadata URI (optional), price/period, period duration, challenge window, grace period, target uptime %
- Calls `registerService()` on the smart contract
- After confirmation, the DB indexer syncs automatically

**Contract function:** `registerService(name, metadataUri, pricePerPeriod, periodDuration, challengeWindow, gracePeriod, targetUptimeBps)`

### F-03 Subscribe to Service

Two-step flow:
1. **Approve USDC:** Call `USDC.approve(VeritaPay, maxUint256)` — only needed once
2. **Subscribe:** Call `subscribe(serviceId, budgetPerPeriod, duration)` — duration = 0 is open-ended

If allowance is already sufficient, step 1 is skipped. Clear messaging indicates which step is in progress.

**Contract functions:** `ERC20.approve`, `subscribe(uint256, uint256, uint256)`

### F-04 Subscription Management (Subscriber Dashboard)

Displays all active subscriptions for the subscriber. Each subscription card shows:
- Service name, budget/period, total paid, periods honored
- Current period with state machine (Pending / Attested / Settled / Disputed / Resolved / Missed)
- State-appropriate actions: Raise Dispute, Force Settle, Mark Missed
- "Full History" toggle loads all periods from the DB (not limited to the contract's 6-period cap)

**Data source:** `getActiveSubscriptions` + `getSubscription` + `getPeriod` (on-chain) + `/api/subscriptions/:id/periods` (DB)

### F-05 Submit Attestation (Vendor)

Vendor dashboard shows:
- List of vendor's services (from DB)
- Aggregate stats bar: subscribers, USDC earned
- On-chain reputation score with semantic color coding
- Queue of subscriptions awaiting attestation (period ended, state = PENDING)
- AttestSheet: enter uptime %, latency p99 (ms), error rate %, evidence hash (optional)
- Attestation history from DB

**Contract function:** `attest(subscriptionId, uptimeBps, latencyP99Ms, errorRateBps, evidenceHash)`

### F-06 Dispute & Resolution

- **Raise dispute:** Subscriber calls `raiseDispute(periodId, reason)` within the challenge window
- **Auto-resolve:** After 7 days with no resolution → contract auto-refunds the subscriber
- **Manual settle:** Vendor or subscriber calls `settlePayment(periodId)` after the challenge window

**Contract functions:** `raiseDispute(uint256, string)`, `settlePayment(uint256)`, `markMissedPeriod(uint256)`

### F-07 Vendor Reputation Score

Bayesian score computed on-chain: `score = (honoredPeriods * 10000) / (totalPeriods + LAPLACE_K)` with Laplace smoothing. Semantic colors: ≥80% green, ≥50% orange, <50% red. Displayed via the reusable `ReputationBadge` component.

**Contract function:** `getVendorReputation(address)`

### F-08 Full Period History

The "Full History" tab in the subscriber dashboard loads from `/api/subscriptions/:id/periods` — complete history with no limit (the contract's `getSubscriptionPeriods` returns max 6). Each row: period index, start/end time, state, attested uptime, settlement amount.

### F-09 Protocol Stats Bar

Bar displaying protocol-wide aggregate metrics from `/api/stats`:
- Total services, subscriptions, periods settled, USDC settled (formatted as $xxx.xx), disputes

### F-10 Light / Dark Theme

Full theme system with CSS custom properties, toggle button in the header, localStorage persistence, anti-flash script, ConnectKit theme sync, and accessibility contrast checking. See `docs/DESIGN_SYSTEM.md` for details.

### F-11 Project Documentation

Documentation set in `docs/` covering: PROJECT_OVERVIEW, TECH_STACK, DESIGN_SYSTEM, CODING_STANDARDS, WORKFLOW. Available in Vietnamese and English.

---

## 4. Architecture Overview

```
Browser
  └─ React (Vite) ─ Port 5173
       ├─ wagmi / viem ──────────────────────── Arc Testnet RPC
       ├─ ConnectKit ─ wallet connect
       └─ /api/* (Vite proxy) ─────────────── Bun Backend ─ Port 3001
                                                    ├─ REST API (Hono)
                                                    ├─ Event Indexer (polls every 6s)
                                                    └─ Drizzle ORM
                                                            └─ PostgreSQL (schema: VeritaPay)

Smart Contract: VeritaPay.sol (Foundry)
  └─ Arc Testnet: 0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f
```

---

## 5. Deployed Contracts

| Contract | Chain | Address |
|---|---|---|
| VeritaPay | Arc Testnet (5042002) | `0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f` |

USDC (Arc Testnet): `0x3600000000000000000000000000000000000000` (6 decimals ERC-20, 18 decimals native gas)
