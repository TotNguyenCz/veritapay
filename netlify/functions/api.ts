/**
 * Netlify Function v2 — handles all /api/* routes in one function.
 * Format: export default async (req: Request) => Response
 *
 * Routing via URL path matching (replaces Vercel file-based routing).
 * Uses the same _db.ts shared client as the Vercel functions.
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(ser(data)), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function err(msg: string, status = 500): Response {
  return json({ error: msg }, status)
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const url = new URL(req.url)
  // Strip the /.netlify/functions/api prefix so paths match cleanly
  const raw = url.pathname
    .replace(/^\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    || '/'

  // /health
  if (raw === '/health' || raw === '') {
    return json({ status: 'ok', ts: Date.now() })
  }

  if (!rawUrl) return err('DATABASE_URL not configured', 503)

  try {
    // /stats
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

    // /services
    if (raw === '/services') {
      const rows = await db.query.services.findMany({
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // /services/:id
    const svcMatch = raw.match(/^\/services\/(\d+)$/)
    if (svcMatch) {
      const id = BigInt(svcMatch[1])
      const row = await db.query.services.findFirst({
        where: eq(services.serviceId, id),
      })
      if (!row) return err('Not found', 404)
      return json(row)
    }

    // /services/:id/subscriptions
    const svcSubsMatch = raw.match(/^\/services\/(\d+)\/subscriptions$/)
    if (svcSubsMatch) {
      const id = BigInt(svcSubsMatch[1])
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.serviceId, id),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return json(rows)
    }

    // /subscriptions/:id
    const subMatch = raw.match(/^\/subscriptions\/(\d+)$/)
    if (subMatch) {
      const id = BigInt(subMatch[1])
      const row = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.subscriptionId, id),
      })
      if (!row) return err('Not found', 404)
      return json(row)
    }

    // /subscriptions/:id/periods
    const subPeriodsMatch = raw.match(/^\/subscriptions\/(\d+)\/periods$/)
    if (subPeriodsMatch) {
      const id = BigInt(subPeriodsMatch[1])
      const rows = await db.query.periods.findMany({
        where: eq(periods.subscriptionId, id),
        orderBy: [desc(periods.periodIndex)],
      })
      return json(rows)
    }

    // /vendor/:addr/services
    const vendorSvcMatch = raw.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/services$/)
    if (vendorSvcMatch) {
      const addr = vendorSvcMatch[1].toLowerCase()
      const rows = await db.query.services.findMany({
        where: eq(services.vendorAddress, addr),
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // /vendor/:addr/attestations
    const vendorAttestMatch = raw.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/attestations$/)
    if (vendorAttestMatch) {
      const addr = vendorAttestMatch[1].toLowerCase()
      const rows = await db.query.attestations.findMany({
        where: eq(attestations.vendorAddress, addr),
        orderBy: [desc(attestations.attestedAtTs)],
      })
      return json(rows)
    }

    return err('Not found', 404)
  } catch (e) {
    console.error('[api]', e)
    return err(String(e), 500)
  }
}
