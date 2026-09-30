/**
 * VeritaPay PostgreSQL schema (Drizzle ORM)
 * All tables live in the "VeritaPay" schema (parsed from DATABASE_URL ?schema=).
 *
 * Tables:
 *   services          – vendor service listings
 *   subscriptions     – subscriber subscriptions
 *   periods           – billing periods + state transitions
 *   attestations      – vendor attestation event log
 *   disputes          – subscriber dispute event log
 *   indexer_cursors   – last-seen block per event type
 */

import {
  pgSchema,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  smallint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// All tables are scoped to the "VeritaPay" schema
export const veritaPaySchema = pgSchema('VeritaPay')

// ─────────────────────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────────────────────

export const services = veritaPaySchema.table(
  'services',
  {
    id: serial('id').primaryKey(),
    serviceId: bigint('service_id', { mode: 'bigint' }).notNull(),
    vendor: text('vendor').notNull(),
    name: text('name').notNull(),
    metadataUri: text('metadata_uri').notNull().default(''),
    pricePerPeriod: numeric('price_per_period', { precision: 40 }).notNull(),
    periodDuration: integer('period_duration').notNull(),
    challengeWindow: integer('challenge_window').notNull(),
    gracePeriod: integer('grace_period').notNull(),
    targetUptimeBps: smallint('target_uptime_bps').notNull(),
    active: boolean('active').notNull().default(true),
    createdAtBlock: bigint('created_at_block', { mode: 'bigint' }).notNull(),
    createdAtTs: timestamp('created_at_ts').notNull(),
    totalSubscribers: integer('total_subscribers').notNull().default(0),
    totalPeriodsSettled: integer('total_periods_settled').notNull().default(0),
    totalUsdcSettled: numeric('total_usdc_settled', { precision: 40 }).notNull().default('0'),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('services_service_id_idx').on(t.serviceId),
    index('services_vendor_idx').on(t.vendor),
  ]
)

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptions = veritaPaySchema.table(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    subscriptionId: bigint('subscription_id', { mode: 'bigint' }).notNull(),
    serviceId: bigint('service_id', { mode: 'bigint' }).notNull(),
    subscriber: text('subscriber').notNull(),
    maxBudgetPerPeriod: numeric('max_budget_per_period', { precision: 40 }).notNull(),
    periodsRemaining: integer('periods_remaining').notNull(),
    active: boolean('active').notNull().default(true),
    startedAtBlock: bigint('started_at_block', { mode: 'bigint' }).notNull(),
    startedAtTs: timestamp('started_at_ts').notNull(),
    totalPaid: numeric('total_paid', { precision: 40 }).notNull().default('0'),
    periodsCompleted: integer('periods_completed').notNull().default(0),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subscriptions_sub_id_idx').on(t.subscriptionId),
    index('subscriptions_subscriber_idx').on(t.subscriber),
    index('subscriptions_service_id_idx').on(t.serviceId),
  ]
)

// ─────────────────────────────────────────────────────────────────────────────
// Periods  (PeriodState: 0=PENDING 1=ATTESTED 2=SETTLED 3=DISPUTED 4=RESOLVED 5=MISSED)
// ─────────────────────────────────────────────────────────────────────────────

export const periods = veritaPaySchema.table(
  'periods',
  {
    id: serial('id').primaryKey(),
    subscriptionId: bigint('subscription_id', { mode: 'bigint' }).notNull(),
    periodIndex: integer('period_index').notNull(),
    periodStart: bigint('period_start', { mode: 'bigint' }).notNull(),
    periodEnd: bigint('period_end', { mode: 'bigint' }).notNull(),
    state: smallint('state').notNull().default(0),
    attestedUptimeBps: smallint('attested_uptime_bps'),
    attestedLatencyMs: integer('attested_latency_ms'),
    attestedErrorRateBps: smallint('attested_error_rate_bps'),
    attestedEvidenceHash: text('attested_evidence_hash'),
    attestedAt: timestamp('attested_at'),
    attestedBlock: bigint('attested_block', { mode: 'bigint' }),
    settledAmount: numeric('settled_amount', { precision: 40 }),
    settledAt: timestamp('settled_at'),
    settledBlock: bigint('settled_block', { mode: 'bigint' }),
    disputedAt: timestamp('disputed_at'),
    disputedBlock: bigint('disputed_block', { mode: 'bigint' }),
    resolvedAt: timestamp('resolved_at'),
    resolvedBlock: bigint('resolved_block', { mode: 'bigint' }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('periods_sub_period_idx').on(t.subscriptionId, t.periodIndex),
    index('periods_subscription_id_idx').on(t.subscriptionId),
    index('periods_state_idx').on(t.state),
    index('periods_period_end_idx').on(t.periodEnd),
  ]
)

// ─────────────────────────────────────────────────────────────────────────────
// Attestations  (immutable event log)
// ─────────────────────────────────────────────────────────────────────────────

export const attestations = veritaPaySchema.table(
  'attestations',
  {
    id: serial('id').primaryKey(),
    txHash: text('tx_hash').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    subscriptionId: bigint('subscription_id', { mode: 'bigint' }).notNull(),
    periodIndex: integer('period_index').notNull(),
    vendor: text('vendor').notNull(),
    uptimeBps: smallint('uptime_bps').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    errorRateBps: smallint('error_rate_bps').notNull(),
    evidenceHash: text('evidence_hash').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('attestations_tx_hash_idx').on(t.txHash),
    index('attestations_vendor_idx').on(t.vendor),
    index('attestations_sub_id_idx').on(t.subscriptionId),
  ]
)

// ─────────────────────────────────────────────────────────────────────────────
// Disputes  (immutable event log)
// ─────────────────────────────────────────────────────────────────────────────

export const disputes = veritaPaySchema.table(
  'disputes',
  {
    id: serial('id').primaryKey(),
    txHash: text('tx_hash').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    subscriptionId: bigint('subscription_id', { mode: 'bigint' }).notNull(),
    periodIndex: integer('period_index').notNull(),
    subscriber: text('subscriber').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('disputes_tx_hash_idx').on(t.txHash),
    index('disputes_subscriber_idx').on(t.subscriber),
    index('disputes_sub_id_idx').on(t.subscriptionId),
  ]
)

// ─────────────────────────────────────────────────────────────────────────────
// Indexer cursors
// ─────────────────────────────────────────────────────────────────────────────

export const indexerCursors = veritaPaySchema.table('indexer_cursors', {
  eventType: text('event_type').primaryKey(),
  lastBlock: bigint('last_block', { mode: 'bigint' }).notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
