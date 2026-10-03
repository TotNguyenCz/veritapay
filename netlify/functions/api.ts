/**
 * Netlify Function v2 — handles all /api/* routes in one function.
 * Format: export default async (req: Request) => Response
 *
 * Fixes applied:
 *  - C-01: Use correct schema field names (vendor, blockNumber — not vendorAddress/attestedAtTs)
 *  - H-02: err() defaults to 400, not 500; explicit status on every call
 *  - H-04: Added /vendor/:addr/attestations and /disputes/:addr routes
 */

import { eq, desc, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../../server/db/schema.js'
import {
  services,
  subscriptions,
  periods,
  attestations,
  disputes,
} from '../../server/db/schema.js'

// ── DB singleton ──────────────────────────────────────────────────────────────
const rawUrl = process.env.DATABASE_URL ?? ''
const connectionString = rawUrl.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '')
const schemaMatch = rawUrl.match(/[?&]schema=([^&]+)/)
const schemaName = schemaMatch ? schemaMatch[1] : 'VeritaPay'

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
    _pool.on('connect', (client) => {
      void client.query(`SET search_path TO "${schemaName}",public`)
    })
  }
  return _pool
}
const db = drizzle(getPool(), { schema })

// ── Helpers ───────────────────────────────────────────────────────────────────
function ser(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val,
  ))
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(ser(data)), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// H-02 fix: separate defaults — 404 for not-found, 400 for bad request
function notFound(msg = 'Not found'): Response { return json({ error: msg }, 404) }
function badRequest(msg: string): Response { return json({ error: msg }, 400) }
function serverError(msg: string): Response { return json({ error: msg }, 500) }
function unavailable(msg: string): Response { return json({ error: msg }, 503) }

/** Parse a bigint from a string; returns null on failure (safe, no throw) */
function parseBigInt(s: string): bigint | null {
  try { return BigInt(s) } catch { return null }
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  // Strip the /.netlify/functions/api prefix so paths match cleanly
  const raw = url.pathname
    .replace(/^\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    || '/'

  // /health — does NOT require DB
  if (raw === '/health' || raw === '') {
    return json({ status: 'ok', ts: Date.now() })
  }

  // Guard: all routes below need DATABASE_URL
  if (!rawUrl) return unavailable('DATABASE_URL not configured')

  try {
    // ── /stats ──────────────────────────────────────────────────────────────
    if (raw === '/stats') {
      const [svcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(services)
      const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions)
      const [periodStats] = await db.select({
        settled:  sql<number>`count(*) filter (where state = 2)::int`,
        disputed: sql<number>`count(*) filter (where state = 3)::int`,
        missed:   sql<number>`count(*) filter (where state = 5)::int`,
      }).from(periods)
      const [totalUsdc] = await db
        .select({ total: sql<string>`coalesce(sum(settled_amount::numeric),0)::text` })
        .from(periods)
        .where(eq(periods.state, 2))
      return json({
        totalServices:      svcCount?.count      ?? 0,
        totalSubscriptions: subCount?.count       ?? 0,
        periodsSettled:     periodStats?.settled  ?? 0,
        periodsDisputed:    periodStats?.disputed ?? 0,
        periodsMissed:      periodStats?.missed   ?? 0,
        totalUsdcSettled:   totalUsdc?.total      ?? '0',
      })
    }

    // ── /services ────────────────────────────────────────────────────────────
    if (raw === '/services') {
      const rows = await db.query.services.findMany({
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // ── /services/:id/subscriptions (must match before /services/:id) ────────
    const svcSubsMatch = raw.match(/^\/services\/(\d+)\/subscriptions$/)
    if (svcSubsMatch) {
      const id = parseBigInt(svcSubsMatch[1])
      if (!id) return badRequest('Invalid service id')
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.serviceId, id),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return json(rows)
    }

    // ── /services/:id ────────────────────────────────────────────────────────
    const svcMatch = raw.match(/^\/services\/(\d+)$/)
    if (svcMatch) {
      const id = parseBigInt(svcMatch[1])
      if (!id) return badRequest('Invalid service id')
      const row = await db.query.services.findFirst({
        where: eq(services.serviceId, id),
      })
      if (!row) return notFound('Service not found')
      return json(row)
    }

    // ── /subscriptions/:id/periods (must match before /subscriptions/:id) ───
    const subPeriodsMatch = raw.match(/^\/subscriptions\/(\d+)\/periods$/)
    if (subPeriodsMatch) {
      const id = parseBigInt(subPeriodsMatch[1])
      if (!id) return badRequest('Invalid subscription id')
      const rows = await db.query.periods.findMany({
        where: eq(periods.subscriptionId, id),
        orderBy: [desc(periods.periodIndex)],
      })
      return json(rows)
    }

    // ── /subscriptions/:id ───────────────────────────────────────────────────
    const subMatch = raw.match(/^\/subscriptions\/(\d+)$/)
    if (subMatch) {
      const id = parseBigInt(subMatch[1])
      if (!id) return badRequest('Invalid subscription id')
      const row = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.subscriptionId, id),
      })
      if (!row) return notFound('Subscription not found')
      return json(row)
    }

    // ── /vendor/:addr/services ────────────────────────────────────────────────
    // C-01 fix: use services.vendor (not vendorAddress)
    const vendorSvcMatch = raw.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/services$/)
    if (vendorSvcMatch) {
      const addr = vendorSvcMatch[1].toLowerCase()
      const rows = await db.query.services.findMany({
        where: eq(services.vendor, addr),     // ← C-01 fix
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // ── /vendor/:addr/attestations ────────────────────────────────────────────
    // C-01 fix: use attestations.vendor + attestations.blockNumber (not vendorAddress/attestedAtTs)
    const vendorAttestMatch = raw.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/attestations$/)
    if (vendorAttestMatch) {
      const addr = vendorAttestMatch[1].toLowerCase()
      const rows = await db.query.attestations.findMany({
        where: eq(attestations.vendor, addr),       // ← C-01 fix
        orderBy: [desc(attestations.blockNumber)],  // ← C-01 fix
      })
      return json(rows)
    }

    // ── /disputes/:addr (H-04 fix: added) ────────────────────────────────────
    const disputesMatch = raw.match(/^\/disputes\/(0x[0-9a-fA-F]{40})$/)
    if (disputesMatch) {
      const addr = disputesMatch[1].toLowerCase()
      const rows = await db.query.disputes.findMany({
        where: eq(disputes.subscriber, addr),
        orderBy: [desc(disputes.blockNumber)],
      })
      return json(rows)
    }

    return notFound()
  } catch (e) {
    console.error('[api] unhandled error:', e)
    return serverError(e instanceof Error ? e.message : String(e))
  }
}
