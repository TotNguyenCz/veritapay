/**
 * VeritaPay schema bootstrap.
 *
 * Reads the target schema name from DATABASE_URL (?schema=...).
 * Creates the schema if it doesn't exist, then creates all tables
 * with IF NOT EXISTS so this is fully idempotent.
 *
 * We use raw SQL here (not the Drizzle migrator) because:
 *  – The Drizzle migrator doesn't support per-schema migrations cleanly.
 *  – The user may point DATABASE_URL at a server that already has the schema
 *    or already has the tables — we must not fail in either case.
 */

import postgres from 'postgres'

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set in .env')
  // Strip ?schema= — we set search_path manually so postgres.js doesn't pass
  // an unknown config parameter to the server.
  return raw.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '')
}

function getSchemaName(): string {
  const url = process.env.DATABASE_URL ?? ''
  const m = url.match(/[?&]schema=([^&]+)/)
  return m ? m[1] : 'VeritaPay'
}

export { getSchemaName }

export async function runMigrations() {
  const connectionString = getConnectionString()
  const schema = getSchemaName()

  const sql = postgres(connectionString, { max: 1 })

  try {
    // 1. Create schema
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
    console.log(`[migrate] Schema "${schema}" ready`)

    // 2. Set search_path for this session
    await sql.unsafe(`SET search_path TO "${schema}"`)

    // 3. Create all tables with IF NOT EXISTS
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."services" (
        "id"                    serial PRIMARY KEY,
        "service_id"            bigint NOT NULL,
        "vendor"                text NOT NULL,
        "name"                  text NOT NULL,
        "metadata_uri"          text NOT NULL DEFAULT '',
        "price_per_period"      numeric(40) NOT NULL,
        "period_duration"       integer NOT NULL,
        "challenge_window"      integer NOT NULL,
        "grace_period"          integer NOT NULL,
        "target_uptime_bps"     smallint NOT NULL,
        "active"                boolean NOT NULL DEFAULT true,
        "created_at_block"      bigint NOT NULL,
        "created_at_ts"         timestamp NOT NULL,
        "total_subscribers"     integer NOT NULL DEFAULT 0,
        "total_periods_settled" integer NOT NULL DEFAULT 0,
        "total_usdc_settled"    numeric(40) NOT NULL DEFAULT '0',
        "synced_at"             timestamp NOT NULL DEFAULT now()
      )
    `)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."subscriptions" (
        "id"                     serial PRIMARY KEY,
        "subscription_id"        bigint NOT NULL,
        "service_id"             bigint NOT NULL,
        "subscriber"             text NOT NULL,
        "max_budget_per_period"  numeric(40) NOT NULL,
        "periods_remaining"      integer NOT NULL,
        "active"                 boolean NOT NULL DEFAULT true,
        "started_at_block"       bigint NOT NULL,
        "started_at_ts"          timestamp NOT NULL,
        "total_paid"             numeric(40) NOT NULL DEFAULT '0',
        "periods_completed"      integer NOT NULL DEFAULT 0,
        "synced_at"              timestamp NOT NULL DEFAULT now()
      )
    `)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."periods" (
        "id"                       serial PRIMARY KEY,
        "subscription_id"          bigint NOT NULL,
        "period_index"             integer NOT NULL,
        "period_start"             bigint NOT NULL,
        "period_end"               bigint NOT NULL,
        "state"                    smallint NOT NULL DEFAULT 0,
        "attested_uptime_bps"      smallint,
        "attested_latency_ms"      integer,
        "attested_error_rate_bps"  smallint,
        "attested_evidence_hash"   text,
        "attested_at"              timestamp,
        "attested_block"           bigint,
        "settled_amount"           numeric(40),
        "settled_at"               timestamp,
        "settled_block"            bigint,
        "disputed_at"              timestamp,
        "disputed_block"           bigint,
        "resolved_at"              timestamp,
        "resolved_block"           bigint,
        "synced_at"                timestamp NOT NULL DEFAULT now()
      )
    `)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."attestations" (
        "id"               serial PRIMARY KEY,
        "tx_hash"          text NOT NULL,
        "block_number"     bigint NOT NULL,
        "subscription_id"  bigint NOT NULL,
        "period_index"     integer NOT NULL,
        "vendor"           text NOT NULL,
        "uptime_bps"       smallint NOT NULL,
        "latency_ms"       integer NOT NULL,
        "error_rate_bps"   smallint NOT NULL,
        "evidence_hash"    text NOT NULL DEFAULT '',
        "created_at"       timestamp NOT NULL DEFAULT now()
      )
    `)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."disputes" (
        "id"               serial PRIMARY KEY,
        "tx_hash"          text NOT NULL,
        "block_number"     bigint NOT NULL,
        "subscription_id"  bigint NOT NULL,
        "period_index"     integer NOT NULL,
        "subscriber"       text NOT NULL,
        "created_at"       timestamp NOT NULL DEFAULT now()
      )
    `)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."indexer_cursors" (
        "event_type"  text PRIMARY KEY,
        "last_block"  bigint NOT NULL,
        "updated_at"  timestamp NOT NULL DEFAULT now()
      )
    `)

    // 4. Create indexes (IF NOT EXISTS — Postgres 9.5+)
    const indexes: string[] = [
      `CREATE UNIQUE INDEX IF NOT EXISTS services_service_id_idx   ON "${schema}".services (service_id)`,
      `CREATE        INDEX IF NOT EXISTS services_vendor_idx       ON "${schema}".services (vendor)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_sub_id_idx  ON "${schema}".subscriptions (subscription_id)`,
      `CREATE        INDEX IF NOT EXISTS subscriptions_sub_idx     ON "${schema}".subscriptions (subscriber)`,
      `CREATE        INDEX IF NOT EXISTS subscriptions_svc_idx     ON "${schema}".subscriptions (service_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS periods_sub_period_idx    ON "${schema}".periods (subscription_id, period_index)`,
      `CREATE        INDEX IF NOT EXISTS periods_sub_idx           ON "${schema}".periods (subscription_id)`,
      `CREATE        INDEX IF NOT EXISTS periods_state_idx         ON "${schema}".periods (state)`,
      `CREATE        INDEX IF NOT EXISTS periods_end_idx           ON "${schema}".periods (period_end)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS attestations_tx_idx       ON "${schema}".attestations (tx_hash)`,
      `CREATE        INDEX IF NOT EXISTS attestations_vendor_idx   ON "${schema}".attestations (vendor)`,
      `CREATE        INDEX IF NOT EXISTS attestations_sub_idx      ON "${schema}".attestations (subscription_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS disputes_tx_idx           ON "${schema}".disputes (tx_hash)`,
      `CREATE        INDEX IF NOT EXISTS disputes_subscriber_idx   ON "${schema}".disputes (subscriber)`,
      `CREATE        INDEX IF NOT EXISTS disputes_sub_idx          ON "${schema}".disputes (subscription_id)`,
    ]
    for (const idx of indexes) {
      await sql.unsafe(idx)
    }

    console.log(`[migrate] All tables and indexes ready in schema "${schema}"`)
  } finally {
    await sql.end()
  }
}

// Run when executed directly (bun run db:migrate)
if (import.meta.main) {
  runMigrations().catch((err) => {
    console.error('[migrate] Fatal:', err)
    process.exit(1)
  })
}
