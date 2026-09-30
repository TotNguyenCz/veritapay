/**
 * VeritaPay seed script — inserts sample data into the VeritaPay schema.
 * Run with:  bun run db:seed
 *
 * Idempotent: skips rows that already exist (by service_id / subscription_id).
 *
 * NOTE: Addresses below are intentional seed-data fixtures — deterministic
 * placeholder addresses used only for demo data, never funded wallets.
 */

// arc-studio-allow-onchain-literal

import postgres from 'postgres'

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set')
  return raw.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '')
}

function getSchemaName(): string {
  const url = process.env.DATABASE_URL ?? ''
  const m = url.match(/[?&]schema=([^&]+)/)
  return m ? m[1] : 'VeritaPay'
}

const nowSec = () => Math.floor(Date.now() / 1000)

/** USDC amount in raw 6-decimal units as string */
function usdc(amount: number): string {
  return String(Math.round(amount * 1_000_000))
}

// Deterministic placeholder addresses — not real wallets, never funded
const VENDOR_A   = '0xAAAA000000000000000000000000000000000001' // arc-studio-allow-onchain-literal
const VENDOR_B   = '0xBBBB000000000000000000000000000000000002' // arc-studio-allow-onchain-literal
const VENDOR_C   = '0xCCCC000000000000000000000000000000000003' // arc-studio-allow-onchain-literal
const CLIENT_1   = '0xDEAD000000000000000000000000000000000001' // arc-studio-allow-onchain-literal
const CLIENT_2   = '0xDEAD000000000000000000000000000000000002' // arc-studio-allow-onchain-literal
const CLIENT_3   = '0xDEAD000000000000000000000000000000000003' // arc-studio-allow-onchain-literal

async function main() {
  const connectionString = getConnectionString()
  const schema = getSchemaName()
  const sql = postgres(connectionString, { max: 1 })

  console.log(`[seed] Targeting schema "${schema}"`)

  // ── 1. Services ──────────────────────────────────────────────────────────────
  const now = nowSec()
  const p30 = 2592000   // 30 days in seconds
  const p7  = 604800    // 7 days in seconds

  const serviceRows = [
    {
      service_id: 1, vendor: VENDOR_A, name: 'UptimeGuard Pro',
      metadata_uri: 'ipfs://bafybeig...uptimeguard',
      price_per_period: usdc(49.99), period_duration: p30,
      challenge_window: 172800, grace_period: 86400, target_uptime_bps: 9950,
      active: true, created_at_block: 1000,
      created_at_ts: new Date((now - 90 * 86400) * 1000),
      total_subscribers: 12, total_periods_settled: 34, total_usdc_settled: usdc(1699.66),
    },
    {
      service_id: 2, vendor: VENDOR_B, name: 'EdgeAPI Gateway',
      metadata_uri: 'ipfs://bafybeig...edgeapi',
      price_per_period: usdc(19.00), period_duration: p7,
      challenge_window: 86400, grace_period: 43200, target_uptime_bps: 9900,
      active: true, created_at_block: 1250,
      created_at_ts: new Date((now - 60 * 86400) * 1000),
      total_subscribers: 7, total_periods_settled: 56, total_usdc_settled: usdc(1064.00),
    },
    {
      service_id: 3, vendor: VENDOR_C, name: 'DataStream Relay',
      metadata_uri: 'ipfs://bafybeig...datastream',
      price_per_period: usdc(99.00), period_duration: p30,
      challenge_window: 172800, grace_period: 86400, target_uptime_bps: 9990,
      active: true, created_at_block: 1500,
      created_at_ts: new Date((now - 45 * 86400) * 1000),
      total_subscribers: 3, total_periods_settled: 9, total_usdc_settled: usdc(891.00),
    },
    {
      service_id: 4, vendor: VENDOR_A, name: 'LowLatency RPC',
      metadata_uri: '',
      price_per_period: usdc(9.99), period_duration: p7,
      challenge_window: 43200, grace_period: 21600, target_uptime_bps: 9800,
      active: true, created_at_block: 1800,
      created_at_ts: new Date((now - 30 * 86400) * 1000),
      total_subscribers: 5, total_periods_settled: 20, total_usdc_settled: usdc(199.80),
    },
  ]

  for (const row of serviceRows) {
    await sql.unsafe(`
      INSERT INTO "${schema}".services
        (service_id, vendor, name, metadata_uri, price_per_period,
         period_duration, challenge_window, grace_period, target_uptime_bps,
         active, created_at_block, created_at_ts,
         total_subscribers, total_periods_settled, total_usdc_settled)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (service_id) DO NOTHING
    `, [
      row.service_id, row.vendor.toLowerCase(), row.name, row.metadata_uri, row.price_per_period,
      row.period_duration, row.challenge_window, row.grace_period, row.target_uptime_bps,
      row.active, row.created_at_block, row.created_at_ts,
      row.total_subscribers, row.total_periods_settled, row.total_usdc_settled,
    ])
  }
  console.log(`[seed] ${serviceRows.length} services`)

  // ── 2. Subscriptions ──────────────────────────────────────────────────────────
  const subscriptionRows = [
    {
      subscription_id: 1, service_id: 1, subscriber: CLIENT_1,
      max_budget_per_period: usdc(55.00), periods_remaining: 3, active: true,
      started_at_block: 2000, started_at_ts: new Date((now - 90 * 86400) * 1000),
      total_paid: usdc(149.97), periods_completed: 3,
    },
    {
      subscription_id: 2, service_id: 2, subscriber: CLIENT_1,
      max_budget_per_period: usdc(22.00), periods_remaining: 4, active: true,
      started_at_block: 2100, started_at_ts: new Date((now - 56 * 86400) * 1000),
      total_paid: usdc(152.00), periods_completed: 8,
    },
    {
      subscription_id: 3, service_id: 1, subscriber: CLIENT_2,
      max_budget_per_period: usdc(50.00), periods_remaining: 2, active: true,
      started_at_block: 2200, started_at_ts: new Date((now - 60 * 86400) * 1000),
      total_paid: usdc(99.98), periods_completed: 2,
    },
    {
      subscription_id: 4, service_id: 3, subscriber: CLIENT_3,
      max_budget_per_period: usdc(105.00), periods_remaining: 1, active: true,
      started_at_block: 2300, started_at_ts: new Date((now - 45 * 86400) * 1000),
      total_paid: usdc(297.00), periods_completed: 3,
    },
    {
      subscription_id: 5, service_id: 4, subscriber: CLIENT_2,
      max_budget_per_period: usdc(10.00), periods_remaining: 0, active: false,
      started_at_block: 2400, started_at_ts: new Date((now - 28 * 86400) * 1000),
      total_paid: usdc(39.96), periods_completed: 4,
    },
  ]

  for (const row of subscriptionRows) {
    await sql.unsafe(`
      INSERT INTO "${schema}".subscriptions
        (subscription_id, service_id, subscriber, max_budget_per_period,
         periods_remaining, active, started_at_block, started_at_ts,
         total_paid, periods_completed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (subscription_id) DO NOTHING
    `, [
      row.subscription_id, row.service_id, row.subscriber.toLowerCase(),
      row.max_budget_per_period, row.periods_remaining, row.active,
      row.started_at_block, row.started_at_ts, row.total_paid, row.periods_completed,
    ])
  }
  console.log(`[seed] ${subscriptionRows.length} subscriptions`)

  // ── 3. Periods ────────────────────────────────────────────────────────────────
  const s1start = now - 90 * 86400

  interface PeriodRow {
    subscription_id: number
    period_index: number
    period_start: number
    period_end: number
    state: number
    attested_uptime_bps: number | null
    attested_latency_ms: number | null
    attested_error_rate_bps: number | null
    attested_evidence_hash: string | null
    attested_at: Date | null
    attested_block: number | null
    settled_amount: string | null
    settled_at: Date | null
    settled_block: number | null
    disputed_at: Date | null
    disputed_block: number | null
    resolved_at: null
    resolved_block: null
  }

  const periodRows: PeriodRow[] = [
    // Sub 1 — 30-day: period 0 SETTLED, period 1 SETTLED, period 2 ATTESTED
    {
      subscription_id: 1, period_index: 0,
      period_start: s1start, period_end: s1start + p30, state: 2,
      attested_uptime_bps: 9960, attested_latency_ms: 82, attested_error_rate_bps: 10,
      attested_evidence_hash: '0xabcd', attested_at: new Date((s1start + p30 + 3600) * 1000), attested_block: 3000,
      settled_amount: usdc(49.69), settled_at: new Date((s1start + p30 + 176400) * 1000), settled_block: 3050,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    },
    {
      subscription_id: 1, period_index: 1,
      period_start: s1start + p30, period_end: s1start + 2 * p30, state: 2,
      attested_uptime_bps: 9940, attested_latency_ms: 95, attested_error_rate_bps: 15,
      attested_evidence_hash: '0xabce', attested_at: new Date((s1start + 2 * p30 + 7200) * 1000), attested_block: 3200,
      settled_amount: usdc(49.45), settled_at: new Date((s1start + 2 * p30 + 180000) * 1000), settled_block: 3250,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    },
    {
      subscription_id: 1, period_index: 2,
      period_start: s1start + 2 * p30, period_end: s1start + 3 * p30, state: 1,
      attested_uptime_bps: 9970, attested_latency_ms: 74, attested_error_rate_bps: 8,
      attested_evidence_hash: '0xabcf', attested_at: new Date((now - 3600) * 1000), attested_block: 3400,
      settled_amount: null, settled_at: null, settled_block: null,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    },
    // Sub 2 — 7-day: 5 SETTLED, 1 DISPUTED, 1 PENDING
    ...Array.from({ length: 7 }, (_, i): PeriodRow => {
      const pStart = now - (7 - i) * p7
      const pEnd = pStart + p7
      const state = i < 5 ? 2 : i === 5 ? 3 : 0
      return {
        subscription_id: 2, period_index: i,
        period_start: pStart, period_end: pEnd, state,
        attested_uptime_bps: state >= 1 ? 9910 + (i * 7 % 60) : null,
        attested_latency_ms: state >= 1 ? 110 + (i * 11 % 40) : null,
        attested_error_rate_bps: state >= 1 ? 20 : null,
        attested_evidence_hash: state >= 1 ? `0xevid00${i}` : null,
        attested_at: state >= 1 ? new Date((pEnd + 3600) * 1000) : null,
        attested_block: state >= 1 ? 3500 + i * 50 : null,
        settled_amount: state === 2 ? usdc(18.82) : null,
        settled_at: state === 2 ? new Date((pEnd + 90000) * 1000) : null,
        settled_block: state === 2 ? 3550 + i * 50 : null,
        disputed_at: state === 3 ? new Date((pEnd + 7200) * 1000) : null,
        disputed_block: state === 3 ? 3580 : null,
        resolved_at: null, resolved_block: null,
      }
    }),
    // Sub 3 — 30-day: 1 SETTLED, 1 PENDING
    {
      subscription_id: 3, period_index: 0,
      period_start: now - 60 * 86400, period_end: now - 30 * 86400, state: 2,
      attested_uptime_bps: 9955, attested_latency_ms: 88, attested_error_rate_bps: 12,
      attested_evidence_hash: '0xsub3p0', attested_at: new Date((now - 29 * 86400) * 1000), attested_block: 4000,
      settled_amount: usdc(49.69), settled_at: new Date((now - 27 * 86400) * 1000), settled_block: 4050,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    },
    {
      subscription_id: 3, period_index: 1,
      period_start: now - 30 * 86400, period_end: now + p30, state: 0,
      attested_uptime_bps: null, attested_latency_ms: null, attested_error_rate_bps: null,
      attested_evidence_hash: null, attested_at: null, attested_block: null,
      settled_amount: null, settled_at: null, settled_block: null,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    },
    // Sub 4 — 30-day DataStream: 2 SETTLED, 1 PENDING
    ...Array.from({ length: 3 }, (_, i): PeriodRow => ({
      subscription_id: 4, period_index: i,
      period_start: now - (3 - i) * p30, period_end: now - (2 - i) * p30, state: i < 2 ? 2 : 0,
      attested_uptime_bps: i < 2 ? 9992 : null,
      attested_latency_ms: i < 2 ? 45 : null,
      attested_error_rate_bps: i < 2 ? 4 : null,
      attested_evidence_hash: i < 2 ? `0xstream${i}` : null,
      attested_at: i < 2 ? new Date((now - (2 - i) * p30 + 3600) * 1000) : null,
      attested_block: i < 2 ? 4500 + i * 100 : null,
      settled_amount: i < 2 ? usdc(98.01) : null,
      settled_at: i < 2 ? new Date((now - (2 - i) * p30 + 176400) * 1000) : null,
      settled_block: i < 2 ? 4550 + i * 100 : null,
      disputed_at: null, disputed_block: null, resolved_at: null, resolved_block: null,
    })),
  ]

  let periodCount = 0
  for (const row of periodRows) {
    await sql.unsafe(`
      INSERT INTO "${schema}".periods
        (subscription_id, period_index, period_start, period_end, state,
         attested_uptime_bps, attested_latency_ms, attested_error_rate_bps,
         attested_evidence_hash, attested_at, attested_block,
         settled_amount, settled_at, settled_block,
         disputed_at, disputed_block, resolved_at, resolved_block)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (subscription_id, period_index) DO NOTHING
    `, [
      row.subscription_id, row.period_index, row.period_start, row.period_end, row.state,
      row.attested_uptime_bps, row.attested_latency_ms, row.attested_error_rate_bps,
      row.attested_evidence_hash, row.attested_at, row.attested_block,
      row.settled_amount, row.settled_at, row.settled_block,
      row.disputed_at, row.disputed_block, row.resolved_at, row.resolved_block,
    ])
    periodCount++
  }
  console.log(`[seed] ${periodCount} periods`)

  // ── 4. Attestations ───────────────────────────────────────────────────────────
  const attestRows = [
    { tx: '0xattest001', block: 3000, sub: 1, pi: 0, vendor: VENDOR_A, up: 9960, lat: 82,  err: 10, ev: '0xabcd'   },
    { tx: '0xattest002', block: 3200, sub: 1, pi: 1, vendor: VENDOR_A, up: 9940, lat: 95,  err: 15, ev: '0xabce'   },
    { tx: '0xattest003', block: 3400, sub: 1, pi: 2, vendor: VENDOR_A, up: 9970, lat: 74,  err: 8,  ev: '0xabcf'   },
    { tx: '0xattest010', block: 3500, sub: 2, pi: 0, vendor: VENDOR_B, up: 9912, lat: 118, err: 20, ev: ''          },
    { tx: '0xattest011', block: 3550, sub: 2, pi: 1, vendor: VENDOR_B, up: 9935, lat: 105, err: 18, ev: ''          },
    { tx: '0xattest012', block: 3600, sub: 2, pi: 2, vendor: VENDOR_B, up: 9908, lat: 135, err: 22, ev: ''          },
    { tx: '0xattest013', block: 3650, sub: 2, pi: 3, vendor: VENDOR_B, up: 9921, lat: 112, err: 19, ev: ''          },
    { tx: '0xattest014', block: 3700, sub: 2, pi: 4, vendor: VENDOR_B, up: 9945, lat: 98,  err: 16, ev: ''          },
    { tx: '0xattest015', block: 3750, sub: 2, pi: 5, vendor: VENDOR_B, up: 9915, lat: 125, err: 21, ev: ''          },
    { tx: '0xattest020', block: 4000, sub: 3, pi: 0, vendor: VENDOR_A, up: 9955, lat: 88,  err: 12, ev: '0xsub3p0' },
    { tx: '0xattest030', block: 4500, sub: 4, pi: 0, vendor: VENDOR_C, up: 9992, lat: 45,  err: 4,  ev: '0xstream0'},
    { tx: '0xattest031', block: 4600, sub: 4, pi: 1, vendor: VENDOR_C, up: 9992, lat: 47,  err: 4,  ev: '0xstream1'},
  ]

  for (const r of attestRows) {
    await sql.unsafe(`
      INSERT INTO "${schema}".attestations
        (tx_hash, block_number, subscription_id, period_index,
         vendor, uptime_bps, latency_ms, error_rate_bps, evidence_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (tx_hash) DO NOTHING
    `, [r.tx, r.block, r.sub, r.pi, r.vendor.toLowerCase(), r.up, r.lat, r.err, r.ev])
  }
  console.log(`[seed] ${attestRows.length} attestations`)

  // ── 5. Dispute ────────────────────────────────────────────────────────────────
  await sql.unsafe(`
    INSERT INTO "${schema}".disputes
      (tx_hash, block_number, subscription_id, period_index, subscriber)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (tx_hash) DO NOTHING
  `, ['0xdispute001', 3580, 2, 5, CLIENT_1.toLowerCase()])
  console.log('[seed] 1 dispute')

  await sql.end()
  console.log('[seed] Done.')
}

main().catch((err) => {
  console.error('[seed] Fatal:', err)
  process.exit(1)
})
