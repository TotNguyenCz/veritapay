/**
 * Sync-on-read: fetch recent on-chain events and upsert into DB.
 *
 * Called at the top of each serverless API handler so data is fresh
 * without a long-running indexer process (which cannot run on Netlify/Vercel).
 *
 * Strategy:
 *  - Read cursor from indexer_cursors table.
 *  - Fetch logs from cursor+1 to latest block (capped at MAX_BLOCKS per call).
 *  - Upsert rows.
 *  - Update cursor.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from 'viem'
import { eq } from 'drizzle-orm'
import { db } from './_db.js'
import {
  services,
  subscriptions,
  periods,
  attestations,
  disputes,
  indexerCursors,
} from '../server/db/schema.js'

// ── Chain / contract config ───────────────────────────────────────────────────

const ARC_CHAIN_ID = 5042002
const CONTRACT = (process.env.VITE_VERITAPAY_ADDRESS ?? '') as Address
const DEPLOY_BLOCK: bigint = (() => {
  try { return BigInt(process.env.VITE_VERITAPAY_DEPLOY_BLOCK ?? '0') } catch { return 0n }
})()
// Maximum blocks to scan in one sync call — keeps each request fast.
const MAX_BLOCKS = 5_000n

function buildRpcUrl(): string | null {
  const chains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map(s => s.trim())
  if (process.env.RPC_PROXY_BASE_URL && chains.includes('Arc_Testnet')) {
    return `${process.env.RPC_PROXY_BASE_URL}/api/rpc/Arc_Testnet?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
  }
  // Arc_Testnet not in proxy — use ARC_TESTNET_RPC_URL from env (must be set manually)
  return process.env.ARC_TESTNET_RPC_URL ?? null
}

let _client: ReturnType<typeof createPublicClient> | null = null
function getClient(): ReturnType<typeof createPublicClient> | null {
  if (_client) return _client
  const rpcUrl = buildRpcUrl()
  if (!rpcUrl) return null
  _client = createPublicClient({
    transport: http(rpcUrl, { timeout: 8_000 }),
    chain: {
      id: ARC_CHAIN_ID,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  })
  return _client
}

// ── Event ABIs ────────────────────────────────────────────────────────────────

const EV_SERVICE = parseAbiItem(
  'event ServiceRegistered(uint256 indexed serviceId, address indexed vendor, string name, uint256 pricePerPeriod)'
)
const EV_SUBSCRIBED = parseAbiItem(
  'event Subscribed(uint256 indexed subscriptionId, uint256 indexed serviceId, address indexed subscriber, uint256 budgetPerPeriod)'
)
const EV_ATTEST = parseAbiItem(
  'event AttestationSubmitted(uint256 indexed periodId, uint256 indexed subscriptionId, uint256 performanceScore, uint256 paymentAmount)'
)
const EV_SETTLED = parseAbiItem(
  'event PeriodSettled(uint256 indexed periodId, uint256 indexed subscriptionId, address indexed vendor, uint256 amount)'
)
const EV_MISSED = parseAbiItem(
  'event PeriodMissed(uint256 indexed periodId, uint256 indexed subscriptionId)'
)
const EV_DISPUTED = parseAbiItem(
  'event PeriodDisputed(uint256 indexed periodId, address indexed subscriber, string reason)'
)

// ── Read ABI ──────────────────────────────────────────────────────────────────

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
type Subscription   = { serviceId: bigint; subscriber: Address; budgetPerPeriod: bigint; startTime: bigint; endTime: bigint; active: boolean; totalPaid: bigint; totalPeriods: bigint; honestPeriods: bigint; lastProcessedPeriodIndex: bigint }
type Period         = { subscriptionId: bigint; periodIndex: bigint; periodStart: bigint; periodEnd: bigint; state: number; uptimeBps: number; latencyP99Ms: number; errorRateBps: number; performanceScore: bigint; paymentAmount: bigint; evidenceHash: `0x${string}`; attestedAt: bigint; settledAt: bigint; disputeReason: string; disputedAt: bigint }

// ── Cursor helpers ────────────────────────────────────────────────────────────

async function getCursor(eventType: string): Promise<bigint> {
  const row = await db.query.indexerCursors.findFirst({ where: eq(indexerCursors.eventType, eventType) })
  const stored = row?.lastBlock ?? 0n
  return stored < DEPLOY_BLOCK ? DEPLOY_BLOCK : stored
}

async function setCursor(eventType: string, block: bigint) {
  await db
    .insert(indexerCursors)
    .values({ eventType, lastBlock: block, updatedAt: new Date() })
    .onConflictDoUpdate({ target: indexerCursors.eventType, set: { lastBlock: block, updatedAt: new Date() } })
}

// ── Main sync function ────────────────────────────────────────────────────────

/** Syncs recent on-chain events into the DB. Safe to call on every request. */
export async function syncEvents(): Promise<void> {
  if (!CONTRACT || CONTRACT === '0x') return

  const c = getClient()
  if (!c) {
    console.warn('[sync] No RPC URL — set ARC_TESTNET_RPC_URL in env to enable DB sync')
    return
  }

  let latestBlock: bigint
  try {
    latestBlock = await c.getBlockNumber()
  } catch {
    return // RPC unavailable — serve stale DB data
  }

  const cursor = await getCursor('all')
  const fromBlock = cursor + 1n
  if (fromBlock > latestBlock) return // already up to date

  const toBlock = fromBlock + MAX_BLOCKS - 1n < latestBlock
    ? fromBlock + MAX_BLOCKS - 1n
    : latestBlock

  // Fetch all event types in parallel
  const [
    serviceLogs,
    subLogs,
    attestLogs,
    settledLogs,
    missedLogs,
    disputedLogs,
  ] = await Promise.all([
    c.getLogs({ address: CONTRACT, event: EV_SERVICE,    fromBlock, toBlock }).catch(() => []),
    c.getLogs({ address: CONTRACT, event: EV_SUBSCRIBED, fromBlock, toBlock }).catch(() => []),
    c.getLogs({ address: CONTRACT, event: EV_ATTEST,     fromBlock, toBlock }).catch(() => []),
    c.getLogs({ address: CONTRACT, event: EV_SETTLED,    fromBlock, toBlock }).catch(() => []),
    c.getLogs({ address: CONTRACT, event: EV_MISSED,     fromBlock, toBlock }).catch(() => []),
    c.getLogs({ address: CONTRACT, event: EV_DISPUTED,   fromBlock, toBlock }).catch(() => []),
  ])

  // ── ServiceRegistered ─────────────────────────────────────────────────────
  for (const log of serviceLogs) {
    const { serviceId, vendor, name } = log.args as { serviceId: bigint; vendor: Address; name: string; pricePerPeriod: bigint }
    try {
      const svc = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getServiceListing', args: [serviceId] }) as ServiceListing
      const block = await c.getBlock({ blockNumber: log.blockNumber! })
      await db.insert(services).values({
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
        createdAtTs: new Date(Number(block.timestamp) * 1000),
        syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: services.serviceId,
        set: { name: svc.name, active: svc.active, syncedAt: new Date() },
      })
      console.log(`[sync] ServiceRegistered id=${serviceId} vendor=${vendor} name="${name}"`)
    } catch (e) { console.error('[sync] ServiceRegistered error', e) }
  }

  // ── Subscribed ────────────────────────────────────────────────────────────
  for (const log of subLogs) {
    const { subscriptionId, serviceId, subscriber, budgetPerPeriod } = log.args as { subscriptionId: bigint; serviceId: bigint; subscriber: Address; budgetPerPeriod: bigint }
    try {
      const sub = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getSubscription', args: [subscriptionId] }) as Subscription
      const svcRow = await db.query.services.findFirst({ where: eq(services.serviceId, serviceId) })
      const periodDur = svcRow?.periodDuration ?? 86400
      const durationSec = Number(sub.endTime - sub.startTime)
      const periodsRemaining = Math.max(0, Math.floor(durationSec / periodDur))
      const block = await c.getBlock({ blockNumber: log.blockNumber! })
      await db.insert(subscriptions).values({
        subscriptionId,
        serviceId,
        subscriber: subscriber.toLowerCase(),
        maxBudgetPerPeriod: budgetPerPeriod.toString(),
        periodsRemaining,
        active: sub.active,
        startedAtBlock: log.blockNumber!,
        startedAtTs: new Date(Number(block.timestamp) * 1000),
        totalPaid: sub.totalPaid.toString(),
        periodsCompleted: 0,
        syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: subscriptions.subscriptionId,
        set: { active: sub.active, totalPaid: sub.totalPaid.toString(), syncedAt: new Date() },
      })
      console.log(`[sync] Subscribed id=${subscriptionId} svc=${serviceId} sub=${subscriber}`)
    } catch (e) { console.error('[sync] Subscribed error', e) }
  }

  // ── AttestationSubmitted ──────────────────────────────────────────────────
  for (const log of attestLogs) {
    const { periodId, subscriptionId } = log.args as { periodId: bigint; subscriptionId: bigint }
    try {
      const period = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getPeriod', args: [periodId] }) as Period
      const block = await c.getBlock({ blockNumber: log.blockNumber! })
      const attestedAt = new Date(Number(block.timestamp) * 1000)
      await db.insert(periods).values({
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
      }).onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: period.state, attestedUptimeBps: period.uptimeBps, attestedAt, syncedAt: new Date() },
      })
      const subRow = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
      const svcRow = subRow ? await db.query.services.findFirst({ where: eq(services.serviceId, subRow.serviceId) }) : null
      const vendor = svcRow?.vendor ?? '0x0000000000000000000000000000000000000000'
      await db.insert(attestations).values({
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        vendor,
        uptimeBps: period.uptimeBps,
        latencyMs: period.latencyP99Ms,
        errorRateBps: period.errorRateBps,
        evidenceHash: period.evidenceHash,
      }).onConflictDoNothing()
      console.log(`[sync] AttestationSubmitted periodId=${periodId}`)
    } catch (e) { console.error('[sync] AttestationSubmitted error', e) }
  }

  // ── PeriodSettled ─────────────────────────────────────────────────────────
  for (const log of settledLogs) {
    const { periodId, subscriptionId, amount } = log.args as { periodId: bigint; subscriptionId: bigint; vendor: Address; amount: bigint }
    try {
      const period = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getPeriod', args: [periodId] }) as Period
      const block = await c.getBlock({ blockNumber: log.blockNumber! })
      const settledAt = new Date(Number(block.timestamp) * 1000)
      await db.insert(periods).values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 2,
        settledAmount: amount.toString(),
        settledAt,
        settledBlock: log.blockNumber!,
        syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 2, settledAmount: amount.toString(), settledAt, syncedAt: new Date() },
      })
      const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
      if (sub) {
        await db.update(subscriptions).set({
          totalPaid: (BigInt(sub.totalPaid ?? '0') + amount).toString(),
          periodsCompleted: (sub.periodsCompleted ?? 0) + 1,
          syncedAt: new Date(),
        }).where(eq(subscriptions.subscriptionId, subscriptionId))
        const svc = await db.query.services.findFirst({ where: eq(services.serviceId, sub.serviceId) })
        if (svc) {
          await db.update(services).set({
            totalUsdcSettled: (BigInt(svc.totalUsdcSettled ?? '0') + amount).toString(),
            totalPeriodsSettled: (svc.totalPeriodsSettled ?? 0) + 1,
            syncedAt: new Date(),
          }).where(eq(services.serviceId, sub.serviceId))
        }
      }
      console.log(`[sync] PeriodSettled periodId=${periodId} amount=${amount}`)
    } catch (e) { console.error('[sync] PeriodSettled error', e) }
  }

  // ── PeriodMissed ──────────────────────────────────────────────────────────
  for (const log of missedLogs) {
    const { periodId } = log.args as { periodId: bigint }
    try {
      const period = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getPeriod', args: [periodId] }) as Period
      await db.insert(periods).values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 5,
        syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 5, syncedAt: new Date() },
      })
      console.log(`[sync] PeriodMissed periodId=${periodId}`)
    } catch (e) { console.error('[sync] PeriodMissed error', e) }
  }

  // ── PeriodDisputed ────────────────────────────────────────────────────────
  for (const log of disputedLogs) {
    const { periodId, subscriber } = log.args as { periodId: bigint; subscriber: Address }
    try {
      const period = await c.readContract({ address: CONTRACT, abi: READ_ABI, functionName: 'getPeriod', args: [periodId] }) as Period
      const block = await c.getBlock({ blockNumber: log.blockNumber! })
      const disputedAt = new Date(Number(block.timestamp) * 1000)
      await db.insert(periods).values({
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        state: 3,
        disputedAt,
        disputedBlock: log.blockNumber!,
        syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: [periods.subscriptionId, periods.periodIndex],
        set: { state: 3, disputedAt, syncedAt: new Date() },
      })
      await db.insert(disputes).values({
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        subscriptionId: period.subscriptionId,
        periodIndex: Number(period.periodIndex),
        subscriber: subscriber.toLowerCase(),
      }).onConflictDoNothing()
      console.log(`[sync] PeriodDisputed periodId=${periodId}`)
    } catch (e) { console.error('[sync] PeriodDisputed error', e) }
  }

  // Advance unified cursor
  await setCursor('all', toBlock)
}
