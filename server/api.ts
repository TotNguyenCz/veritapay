/**
 * VeritaPay REST API server (Bun.serve)
 *
 * Endpoints:
 *   GET /health
 *   GET /services                          – all active service listings
 *   GET /services/:serviceId               – single service + aggregates
 *   GET /services/:serviceId/subscriptions – subscriptions for a service
 *   GET /subscriptions/:subscriberAddr     – subscriptions for a subscriber
 *   GET /subscriptions/:id/periods         – period history for a subscription
 *   GET /subscriptions/:id                 – single subscription by numeric id
 *   GET /vendor/:vendorAddr/services       – services owned by a vendor
 *   GET /vendor/:vendorAddr/attestations   – attestation history for a vendor
 *   GET /disputes/:subscriberAddr          – disputes raised by a subscriber
 *   GET /stats                             – protocol-wide aggregates
 *
 * Fixes applied:
 *  - C-02: Every route wrapped in try/catch → guaranteed JSON error response
 *  - H-01: OPTIONS preflight handled for CORS
 *  - M-01: parseBigInt/parseAddress helpers — invalid input returns 400, never throws
 *  - M-05: All error responses include CORS headers
 */

import { eq, desc, sql } from 'drizzle-orm'
import { db } from './db/client.js'
import { services, subscriptions, periods, attestations, disputes } from './db/schema.js'

const PORT = parseInt(process.env.API_PORT ?? '3001', 10)

// ── CORS / response helpers ───────────────────────────────────────────────────

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function bigintReplacer(_: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, bigintReplacer), {
    status,
    headers: CORS_HEADERS,
  })
}

function notFound(msg = 'Not found') { return json({ error: msg }, 404) }
function badRequest(msg: string) { return json({ error: msg }, 400) }
function serverError(e: unknown) {
  return json({ error: e instanceof Error ? e.message : String(e) }, 500)
}

/** Safe BigInt parse — returns null on invalid input instead of throwing */
function parseBigInt(s: string): bigint | null {
  try { return BigInt(s) } catch { return null }
}

/** Validate an Ethereum address (0x + 40 hex chars, case-insensitive) */
function parseAddress(s: string): string | null {
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? s.toLowerCase() : null
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // CORS preflight (H-01 fix)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Health (no DB needed) ─────────────────────────────────────────────────
  if (path === '/health') {
    return json({ ok: true, ts: Date.now() })
  }

  // ── All DB routes — wrapped in try/catch (C-02 fix) ───────────────────────
  try {

    // ── Protocol stats ──────────────────────────────────────────────────────
    if (path === '/stats') {
      const [svcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(services)
      const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions)
      const [periodStats] = await db.select({
        settled:  sql<number>`count(*) filter (where state = 2)::int`,
        disputed: sql<number>`count(*) filter (where state = 3)::int`,
        missed:   sql<number>`count(*) filter (where state = 5)::int`,
      }).from(periods)
      const [totalUsdc] = await db.select({
        total: sql<string>`coalesce(sum(settled_amount::numeric), 0)::text`,
      }).from(periods).where(eq(periods.state, 2))

      return json({
        totalServices:       svcCount?.count       ?? 0,
        totalSubscriptions:  subCount?.count        ?? 0,
        periodsSettled:      periodStats?.settled   ?? 0,
        periodsDisputed:     periodStats?.disputed  ?? 0,
        periodsMissed:       periodStats?.missed    ?? 0,
        totalUsdcSettled:    totalUsdc?.total       ?? '0',
      })
    }

    // ── Services list ────────────────────────────────────────────────────────
    if (path === '/services') {
      const rows = await db.query.services.findMany({
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // ── Subscriptions for a service (before /services/:id) ──────────────────
    const svcSubsMatch = path.match(/^\/services\/(\d+)\/subscriptions$/)
    if (svcSubsMatch) {
      const serviceId = parseBigInt(svcSubsMatch[1])
      if (!serviceId) return badRequest('Invalid service id')
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.serviceId, serviceId),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return json(rows)
    }

    // ── Single service ───────────────────────────────────────────────────────
    const svcMatch = path.match(/^\/services\/(\d+)$/)
    if (svcMatch) {
      const serviceId = parseBigInt(svcMatch[1])
      if (!serviceId) return badRequest('Invalid service id')
      const row = await db.query.services.findFirst({ where: eq(services.serviceId, serviceId) })
      if (!row) return notFound('Service not found')
      return json(row)
    }

    // ── Subscriptions for a subscriber (address) ─────────────────────────────
    const subAddrMatch = path.match(/^\/subscriptions\/(0x[0-9a-fA-F]{40})$/)
    if (subAddrMatch) {
      const subscriber = parseAddress(subAddrMatch[1])
      if (!subscriber) return badRequest('Invalid address')
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.subscriber, subscriber),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return json(rows)
    }

    // ── Periods for a subscription (before /subscriptions/:id) ───────────────
    const subPeriodsMatch = path.match(/^\/subscriptions\/(\d+)\/periods$/)
    if (subPeriodsMatch) {
      const subscriptionId = parseBigInt(subPeriodsMatch[1])
      if (!subscriptionId) return badRequest('Invalid subscription id')
      const rows = await db.query.periods.findMany({
        where: eq(periods.subscriptionId, subscriptionId),
        orderBy: [desc(periods.periodIndex)],
      })
      return json(rows)
    }

    // ── Single subscription by numeric id ────────────────────────────────────
    const subIdMatch = path.match(/^\/subscriptions\/(\d+)$/)
    if (subIdMatch) {
      const subscriptionId = parseBigInt(subIdMatch[1])
      if (!subscriptionId) return badRequest('Invalid subscription id')
      const row = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
      if (!row) return notFound('Subscription not found')
      return json(row)
    }

    // ── Vendor services ───────────────────────────────────────────────────────
    const vendorSvcsMatch = path.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/services$/)
    if (vendorSvcsMatch) {
      const vendor = parseAddress(vendorSvcsMatch[1])
      if (!vendor) return badRequest('Invalid address')
      const rows = await db.query.services.findMany({
        where: eq(services.vendor, vendor),
        orderBy: [desc(services.createdAtTs)],
      })
      return json(rows)
    }

    // ── Vendor attestation history ────────────────────────────────────────────
    const vendorAttestMatch = path.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/attestations$/)
    if (vendorAttestMatch) {
      const vendor = parseAddress(vendorAttestMatch[1])
      if (!vendor) return badRequest('Invalid address')
      const rows = await db.query.attestations.findMany({
        where: eq(attestations.vendor, vendor),
        orderBy: [desc(attestations.blockNumber)],
      })
      return json(rows)
    }

    // ── Disputes for a subscriber ─────────────────────────────────────────────
    const disputesMatch = path.match(/^\/disputes\/(0x[0-9a-fA-F]{40})$/)
    if (disputesMatch) {
      const subscriber = parseAddress(disputesMatch[1])
      if (!subscriber) return badRequest('Invalid address')
      const rows = await db.query.disputes.findMany({
        where: eq(disputes.subscriber, subscriber),
        orderBy: [desc(disputes.blockNumber)],
      })
      return json(rows)
    }

    return notFound()

  } catch (e) {
    console.error('[api] unhandled error:', e)
    return serverError(e)
  }
}

export function startApiServer() {
  const server = Bun.serve({
    port: PORT,
    fetch: handleRequest,
  })
  console.log(`[api] Listening on http://localhost:${PORT}`)
  return server
}
