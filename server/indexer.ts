/**
 * VeritaPay on-chain event indexer.
 *
 * Polls Arc Testnet for VeritaPay contract events every 6 seconds,
 * upserts the changes into PostgreSQL, and keeps aggregate counters
 * up to date.
 *
 * Events processed:
 *   ServiceRegistered    → upsert services
 *   Subscribed           → upsert subscriptions
 *   AttestationSubmitted → upsert periods (attested)
 *   PeriodSettled        → upsert periods (settled) + update aggregates
 *   PeriodMissed         → upsert periods (missed)
 *   PeriodDisputed       → upsert periods (disputed) + insert disputes
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { eq } from 'drizzle-orm'
import { db } from './db/client.js'
import {
  services,
  subscriptions,
  periods,
  attestations,
  disputes,
  indexerCursors,
} from './db/schema.js'

// ─── Chain + RPC config ───────────────────────────────────────────────────────

const ARC_TESTNET_CHAIN_ID = 5042002
const CONTRACT_ADDRESS = (process.env.VITE_VERITAPAY_ADDRESS ?? '') as Address

// H-03 fix: Start scanning from the actual deploy block to avoid full chain
// scan from block 0. VITE_VERITAPAY_DEPLOY_BLOCK is optional — set it in .env
// to the block number at which the contract was deployed. Falls back to 0 if
// not set (safe but expensive on a cold start).
const DEPLOY_BLOCK: bigint = (() => {
  const raw = process.env.VITE_VERITAPAY_DEPLOY_BLOCK
  if (!raw) return 0n
  try { return BigInt(raw) } catch { return 0n }
})()

// Build RPC URL from proxy env when Arc_Testnet is in the proxy chain list;
// otherwise fall back to ARC_TESTNET_RPC_URL from .env (set by the server setup).
function buildRpcUrl(): string | null {
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((s) => s.trim())
  if (process.env.RPC_PROXY_BASE_URL && proxyChains.includes('Arc_Testnet')) {
    return (
      process.env.RPC_PROXY_BASE_URL +
      '/api/rpc/Arc_Testnet?_rpc_token=' +
      process.env.RPC_PROXY_TOKEN
    )
  }
  // Proxy does not cover Arc_Testnet — use the fallback set in .env.
  const fallback = process.env.ARC_TESTNET_RPC_URL ?? null
  if (fallback) {
    console.warn('[indexer] Arc_Testnet not in RPC proxy — using ARC_TESTNET_RPC_URL (rate-limit unknown)')
  }
  return fallback
}

const rpcUrl = buildRpcUrl()

// client is null when no RPC URL is available — startIndexer checks this.
const client = rpcUrl
  ? createPublicClient({
      transport: http(rpcUrl),
      chain: {
        id: ARC_TESTNET_CHAIN_ID,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
    })
  : null

// ─── ABI fragments (events only) ─────────────────────────────────────────────

const EV_SERVICE_REGISTERED = parseAbiItem(
  'event ServiceRegistered(uint256 indexed serviceId, address indexed vendor, string name, uint256 pricePerPeriod)'
)
const EV_SUBSCRIBED = parseAbiItem(
  'event Subscribed(uint256 indexed subscriptionId, uint256 indexed serviceId, address indexed subscriber, uint256 budgetPerPeriod)'
)
const EV_ATTESTATION_SUBMITTED = parseAbiItem(
  'event AttestationSubmitted(uint256 indexed periodId, uint256 indexed subscriptionId, uint256 performanceScore, uint256 paymentAmount)'
)
const EV_PERIOD_SETTLED = parseAbiItem(
  'event PeriodSettled(uint256 indexed periodId, uint256 indexed subscriptionId, address indexed vendor, uint256 amount)'
)
const EV_PERIOD_MISSED = parseAbiItem(
  'event PeriodMissed(uint256 indexed periodId, uint256 indexed subscriptionId)'
)
const EV_PERIOD_DISPUTED = parseAbiItem(
  'event PeriodDisputed(uint256 indexed periodId, address indexed subscriber, string reason)'
)

// ─── Full contract ABI for read calls ────────────────────────────────────────

const READ_ABI = [
  { inputs: [{ name: 'serviceId', type: 'uint256' }], name: 'getServiceListing', outputs: [{ type: 'tuple', components: [
    { name: 'vendor', type: 'address' }, { name: 'name', type: 'string' }, { name: 'metadataUri', type: 'string' },
    { name: 'pricePerPeriod', type: 'uint256' }, { name: 'periodDuration', type: 'uint32' },
    { name: 'challengeWindow', type: 'uint32' }, { name: 'gracePeriod', type: 'uint32' },
    { name: 'targetUptimeBps', type: 'uint16' }, { name: 'active', type: 'bool' }, { name: 'createdAt', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'getSubscription', outputs: [{ type: 'tuple', components: [
    { name: 'serviceId', type: 'uint256' }, { name: 'subscriber', type: 'address' },
    { name: 'budgetPerPeriod', type: 'uint256' }, { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' }, { name: 'active', type: 'bool' },
    { name: 'totalPaid', type: 'uint256' }, { name: 'totalPeriods', type: 'uint256' },
    { name: 'honestPeriods', type: 'uint256' }, { name: 'lastProcessedPeriodIndex', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }], name: 'getPeriod', outputs: [{ type: 'tuple', components: [
    { name: 'subscriptionId', type: 'uint256' }, { name: 'periodIndex', type: 'uint256' },
    { name: 'periodStart', type: 'uint256' }, { name: 'periodEnd', type: 'uint256' },
    { name: 'state', type: 'uint8' }, { name: 'uptimeBps', type: 'uint16' },
    { name: 'latencyP99Ms', type: 'uint32' }, { name: 'errorRateBps', type: 'uint16' },
    { name: 'performanceScore', type: 'uint256' }, { name: 'paymentAmount', type: 'uint256' },
    { name: 'evidenceHash', type: 'bytes32' }, { name: 'attestedAt', type: 'uint256' },
    { name: 'settledAt', type: 'uint256' }, { name: 'disputeReason', type: 'string' },
    { name: 'disputedAt', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
] as const

type ServiceListing = { vendor: Address; name: string; metadataUri: string; pricePerPeriod: bigint; periodDuration: number; challengeWindow: number; gracePeriod: number; targetUptimeBps: number; active: boolean; createdAt: bigint }
type Subscription = { serviceId: bigint; subscriber: Address; budgetPerPeriod: bigint; startTime: bigint; endTime: bigint; active: boolean; totalPaid: bigint; totalPeriods: bigint; honestPeriods: bigint; lastProcessedPeriodIndex: bigint }
type Period = { subscriptionId: bigint; periodIndex: bigint; periodStart: bigint; periodEnd: bigint; state: number; uptimeBps: number; latencyP99Ms: number; errorRateBps: number; performanceScore: bigint; paymentAmount: bigint; evidenceHash: `0x${string}`; attestedAt: bigint; settledAt: bigint; disputeReason: string; disputedAt: bigint }

// ─── Cursor helpers ───────────────────────────────────────────────────────────

async function getLastBlock(eventType: string): Promise<bigint> {
  const row = await db.query.indexerCursors.findFirst({
    where: eq(indexerCursors.eventType, eventType),
  })
  return row?.lastBlock ?? 0n
}

async function setLastBlock(eventType: string, block: bigint) {
  await db
    .insert(indexerCursors)
    .values({ eventType, lastBlock: block, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: indexerCursors.eventType,
      set: { lastBlock: block, updatedAt: new Date() },
    })
}

// ─── Block-range helpers ──────────────────────────────────────────────────────

/** Fetch logs in 2 000-block chunks to avoid RPC range limits. */
async function getLogsChunked(
  abi: Parameters<ReturnType<typeof createPublicClient>['getLogs']>[0]['event'],
  fromBlock: bigint,
  toBlock: bigint
) {
  const c = client! // guarded by startIndexer
  const CHUNK = 2000n
  const all: Awaited<ReturnType<typeof c.getLogs>> = []
  for (let from = fromBlock; from <= toBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < toBlock ? from + CHUNK - 1n : toBlock
    const logs = await c.getLogs({
      address: CONTRACT_ADDRESS,
      event: abi,
      fromBlock: from,
      toBlock: to,
    })
    all.push(...logs)
  }
  return all
}

// ─── Individual event handlers ────────────────────────────────────────────────

async function processServiceRegistered(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_SERVICE_REGISTERED, fromBlock, toBlock)
  for (const log of logs) {
    const { serviceId, vendor, name } = log.args as {
      serviceId: bigint; vendor: Address; name: string; pricePerPeriod: bigint
    }
    const svc = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getServiceListing', args: [serviceId],
    }) as ServiceListing

    const block = await client!.getBlock({ blockNumber: log.blockNumber! })
    const createdAt = new Date(Number(block.timestamp) * 1000)

    await db
      .insert(services)
      .values({
        serviceId,
        vendor: vendor.toLowerCase(),
        name: svc.name,
        metadataUri: svc.metadataUri,
        pricePerPeriod: svc.pricePerPeriod.toString(),
        periodDuration: svc.periodDuration,
        challengeWindow: svc.challengeWindow,
        gracePeriod: svc.gracePeriod,
        targetUptimeBps: svc.targetUptimeBps,
        active: svc.active,
        createdAtBlock: log.blockNumber!,
        createdAtTs: createdAt,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: services.serviceId,
        set: { name: svc.name, metadataUri: svc.metadataUri, active: svc.active, syncedAt: new Date() },
      })
    console.log(`[indexer] ServiceRegistered id=${serviceId} vendor=${vendor} name="${name}"`)
  }
}

async function processSubscribed(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_SUBSCRIBED, fromBlock, toBlock)
  for (const log of logs) {
    const { subscriptionId, serviceId, subscriber, budgetPerPeriod } = log.args as {
      subscriptionId: bigint; serviceId: bigint; subscriber: Address; budgetPerPeriod: bigint
    }
    const sub = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getSubscription', args: [subscriptionId],
    }) as Subscription

    const svcRow = await db.query.services.findFirst({ where: eq(services.serviceId, serviceId) })
    const periodDur = svcRow?.periodDuration ?? 86400
    const durationSec = Number(sub.endTime - sub.startTime)
    const periodsRemaining = Math.max(0, Math.floor(durationSec / periodDur))

    const block = await client!.getBlock({ blockNumber: log.blockNumber! })
    const startedAt = new Date(Number(block.timestamp) * 1000)

    await db
      .insert(subscriptions)
      .values({
        subscriptionId,
        serviceId,
        subscriber: subscriber.toLowerCase(),
        maxBudgetPerPeriod: budgetPerPeriod.toString(),
        periodsRemaining,
        active: sub.active,
        startedAtBlock: log.blockNumber!,
        startedAtTs: startedAt,
        totalPaid: sub.totalPaid.toString(),
        periodsCompleted: 0,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.subscriptionId,
        set: { active: sub.active, totalPaid: sub.totalPaid.toString(), syncedAt: new Date() },
      })
    console.log(`[indexer] Subscribed id=${subscriptionId} service=${serviceId} subscriber=${subscriber}`)
  }
}

async function processAttestationSubmitted(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_ATTESTATION_SUBMITTED, fromBlock, toBlock)
  for (const log of logs) {
    const { periodId, subscriptionId } = log.args as {
      periodId: bigint; subscriptionId: bigint; performanceScore: bigint; paymentAmount: bigint
    }
    const period = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getPeriod', args: [periodId],
    }) as Period

    const block = await client!.getBlock({ blockNumber: log.blockNumber! })
    const attestedAt = new Date(Number(block.timestamp) * 1000)

    await db
      .insert(periods)
      .values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: period.state,
        attestedUptimeBps: period.uptimeBps,
        attestedLatencyMs: period.latencyP99Ms,
        attestedErrorRateBps: period.errorRateBps,
        attestedEvidenceHash: period.evidenceHash,
        attestedAt,
        attestedBlock: log.blockNumber!,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: {
          state: period.state,
          attestedUptimeBps: period.uptimeBps,
          attestedLatencyMs: period.latencyP99Ms,
          attestedErrorRateBps: period.errorRateBps,
          attestedEvidenceHash: period.evidenceHash,
          attestedAt,
          attestedBlock: log.blockNumber!,
          syncedAt: new Date(),
        },
      })

    const vendor = await getVendorForSubscription(subscriptionId)
    await db
      .insert(attestations)
      .values({
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        vendor: vendor.toLowerCase(),
        uptimeBps: period.uptimeBps,
        latencyMs: period.latencyP99Ms,
        errorRateBps: period.errorRateBps,
        evidenceHash: period.evidenceHash,
      })
      .onConflictDoNothing()
    console.log(`[indexer] AttestationSubmitted periodId=${periodId}`)
  }
}

async function processPeriodSettled(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_PERIOD_SETTLED, fromBlock, toBlock)
  for (const log of logs) {
    const { periodId, subscriptionId, vendor, amount } = log.args as {
      periodId: bigint; subscriptionId: bigint; vendor: Address; amount: bigint
    }
    const period = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getPeriod', args: [periodId],
    }) as Period

    const block = await client!.getBlock({ blockNumber: log.blockNumber! })
    const settledAt = new Date(Number(block.timestamp) * 1000)

    await db
      .insert(periods)
      .values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 2,
        settledAmount: amount.toString(),
        settledAt,
        settledBlock: log.blockNumber!,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 2, settledAmount: amount.toString(), settledAt, settledBlock: log.blockNumber!, syncedAt: new Date() },
      })

    // Update subscription totals
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
    if (sub) {
      await db
        .update(subscriptions)
        .set({
          totalPaid: (BigInt(sub.totalPaid ?? '0') + amount).toString(),
          periodsCompleted: (sub.periodsCompleted ?? 0) + 1,
          syncedAt: new Date(),
        })
        .where(eq(subscriptions.subscriptionId, subscriptionId))

      // Update service aggregates
      const svc = await db.query.services.findFirst({ where: eq(services.serviceId, sub.serviceId) })
      if (svc) {
        await db
          .update(services)
          .set({
            totalUsdcSettled: (BigInt(svc.totalUsdcSettled ?? '0') + amount).toString(),
            totalPeriodsSettled: (svc.totalPeriodsSettled ?? 0) + 1,
            syncedAt: new Date(),
          })
          .where(eq(services.serviceId, sub.serviceId))
      }
    }
    console.log(`[indexer] PeriodSettled periodId=${periodId} amount=${amount} vendor=${vendor}`)
  }
}

async function processPeriodMissed(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_PERIOD_MISSED, fromBlock, toBlock)
  for (const log of logs) {
    const { periodId } = log.args as { periodId: bigint; subscriptionId: bigint }
    const period = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getPeriod', args: [periodId],
    }) as Period

    await db
      .insert(periods)
      .values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 5,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 5, syncedAt: new Date() },
      })
    console.log(`[indexer] PeriodMissed periodId=${periodId}`)
  }
}

async function processPeriodDisputed(fromBlock: bigint, toBlock: bigint) {
  const logs = await getLogsChunked(EV_PERIOD_DISPUTED, fromBlock, toBlock)
  for (const log of logs) {
    const { periodId, subscriber } = log.args as { periodId: bigint; subscriber: Address; reason: string }
    const period = await client!.readContract({
      address: CONTRACT_ADDRESS, abi: READ_ABI, functionName: 'getPeriod', args: [periodId],
    }) as Period

    const block = await client!.getBlock({ blockNumber: log.blockNumber! })
    const disputedAt = new Date(Number(block.timestamp) * 1000)

    await db
      .insert(periods)
      .values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 3,
        disputedAt,
        disputedBlock: log.blockNumber!,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 3, disputedAt, disputedBlock: log.blockNumber!, syncedAt: new Date() },
      })

    await db
      .insert(disputes)
      .values({
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        subscriber: subscriber.toLowerCase(),
      })
      .onConflictDoNothing()
    console.log(`[indexer] PeriodDisputed periodId=${periodId}`)
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

async function getVendorForSubscription(subscriptionId: bigint): Promise<string> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
  if (!sub) return '0x0000000000000000000000000000000000000000'
  const svc = await db.query.services.findFirst({ where: eq(services.serviceId, sub.serviceId) })
  return svc?.vendor ?? '0x0000000000000000000000000000000000000000'
}

// ─── Main poll loop ───────────────────────────────────────────────────────────

export async function startIndexer() {
  console.log('[indexer] Starting — contract:', CONTRACT_ADDRESS)
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x') {
    console.warn('[indexer] VITE_VERITAPAY_ADDRESS not set — indexer idle')
    return
  }
  if (!client) {
    console.warn('[indexer] No RPC URL available — indexer idle. Set ARC_TESTNET_RPC_URL in .env.')
    return
  }

  const poll = async () => {
    try {
      const latestBlock = await client!.getBlockNumber()

      const [lastService, lastSub, lastAttest, lastSettled, lastMissed, lastDisputed] =
        await Promise.all([
          getLastBlock('ServiceRegistered'),
          getLastBlock('Subscribed'),
          getLastBlock('AttestationSubmitted'),
          getLastBlock('PeriodSettled'),
          getLastBlock('PeriodMissed'),
          getLastBlock('PeriodDisputed'),
        ])

      // If cursor is at or before deploy block, start from deploy block
      // to avoid scanning the entire chain history on cold start (H-03 fix)
      const fromOrGenesis = (last: bigint) => (last <= DEPLOY_BLOCK ? DEPLOY_BLOCK : last + 1n)

      await Promise.all([
        lastService < latestBlock  && processServiceRegistered(fromOrGenesis(lastService), latestBlock),
        lastSub < latestBlock      && processSubscribed(fromOrGenesis(lastSub), latestBlock),
        lastAttest < latestBlock   && processAttestationSubmitted(fromOrGenesis(lastAttest), latestBlock),
        lastSettled < latestBlock  && processPeriodSettled(fromOrGenesis(lastSettled), latestBlock),
        lastMissed < latestBlock   && processPeriodMissed(fromOrGenesis(lastMissed), latestBlock),
        lastDisputed < latestBlock && processPeriodDisputed(fromOrGenesis(lastDisputed), latestBlock),
      ])

      await Promise.all([
        setLastBlock('ServiceRegistered', latestBlock),
        setLastBlock('Subscribed', latestBlock),
        setLastBlock('AttestationSubmitted', latestBlock),
        setLastBlock('PeriodSettled', latestBlock),
        setLastBlock('PeriodMissed', latestBlock),
        setLastBlock('PeriodDisputed', latestBlock),
      ])
    } catch (err) {
      console.error('[indexer] Poll error:', err)
    }
  }

  await poll()
  setInterval(poll, 6_000)
  console.log('[indexer] Running — polling every 6s')
}
