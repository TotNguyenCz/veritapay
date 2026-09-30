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
 *   GET /vendor/:vendorAddr/services       – services owned by a vendor
 *   GET /vendor/:vendorAddr/attestations   – attestation history for a vendor
 *   GET /stats                             – protocol-wide aggregates
 */

import { eq, desc, sql } from 'drizzle-orm'
import { db } from './db/client.js'
import { services, subscriptions, periods, attestations, disputes } from './db/schema.js'

const PORT = parseInt(process.env.API_PORT ?? '3001', 10)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, bigintReplacer), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status)
}

/** Serialize BigInt as string for JSON */
function bigintReplacer(_: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // ── Health ────────────────────────────────────────────────────────────────
  if (path === '/health') {
    return json({ ok: true, ts: Date.now() })
  }

  // ── Protocol stats ────────────────────────────────────────────────────────
  if (path === '/stats') {
    const [svcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(services)
    const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions)
    const [periodStats] = await db.select({
      settled: sql<number>`count(*) filter (where state = 2)::int`,
      disputed: sql<number>`count(*) filter (where state = 3)::int`,
      missed: sql<number>`count(*) filter (where state = 5)::int`,
    }).from(periods)
    const [totalUsdc] = await db.select({
      total: sql<string>`coalesce(sum(settled_amount::numeric), 0)::text`,
    }).from(periods).where(eq(periods.state, 2))

    return json({
      totalServices: svcCount?.count ?? 0,
      totalSubscriptions: subCount?.count ?? 0,
      periodsSettled: periodStats?.settled ?? 0,
      periodsDisputed: periodStats?.disputed ?? 0,
      periodsMissed: periodStats?.missed ?? 0,
      totalUsdcSettled: totalUsdc?.total ?? '0',
    })
  }

  // ── Services list ─────────────────────────────────────────────────────────
  if (path === '/services' && req.method === 'GET') {
    const rows = await db.query.services.findMany({
      orderBy: [desc(services.createdAtTs)],
    })
    return json(rows)
  }

  // ── Single service ────────────────────────────────────────────────────────
  const svcMatch = path.match(/^\/services\/(\d+)$/)
  if (svcMatch && req.method === 'GET') {
    const serviceId = BigInt(svcMatch[1])
    const row = await db.query.services.findFirst({ where: eq(services.serviceId, serviceId) })
    if (!row) return err('Service not found', 404)
    return json(row)
  }

  // ── Subscriptions for a service ───────────────────────────────────────────
  const svcSubsMatch = path.match(/^\/services\/(\d+)\/subscriptions$/)
  if (svcSubsMatch && req.method === 'GET') {
    const serviceId = BigInt(svcSubsMatch[1])
    const rows = await db.query.subscriptions.findMany({
      where: eq(subscriptions.serviceId, serviceId),
      orderBy: [desc(subscriptions.startedAtTs)],
    })
    return json(rows)
  }

  // ── Subscriptions for a subscriber (address) ──────────────────────────────
  const subAddrMatch = path.match(/^\/subscriptions\/(0x[0-9a-fA-F]{40})$/)
  if (subAddrMatch && req.method === 'GET') {
    const subscriber = subAddrMatch[1].toLowerCase()
    const rows = await db.query.subscriptions.findMany({
      where: eq(subscriptions.subscriber, subscriber),
      orderBy: [desc(subscriptions.startedAtTs)],
    })
    return json(rows)
  }

  // ── Periods for a subscription (by numeric subscriptionId) ────────────────
  const subPeriodsMatch = path.match(/^\/subscriptions\/(\d+)\/periods$/)
  if (subPeriodsMatch && req.method === 'GET') {
    const subscriptionId = BigInt(subPeriodsMatch[1])
    const rows = await db.query.periods.findMany({
      where: eq(periods.subscriptionId, subscriptionId),
      orderBy: [desc(periods.periodIndex)],
    })
    return json(rows)
  }

  // ── Single subscription by numeric id ─────────────────────────────────────
  const subIdMatch = path.match(/^\/subscriptions\/(\d+)$/)
  if (subIdMatch && req.method === 'GET') {
    const subscriptionId = BigInt(subIdMatch[1])
    const row = await db.query.subscriptions.findFirst({ where: eq(subscriptions.subscriptionId, subscriptionId) })
    if (!row) return err('Subscription not found', 404)
    return json(row)
  }

  // ── Vendor services ────────────────────────────────────────────────────────
  const vendorSvcsMatch = path.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/services$/)
  if (vendorSvcsMatch && req.method === 'GET') {
    const vendor = vendorSvcsMatch[1].toLowerCase()
    const rows = await db.query.services.findMany({
      where: eq(services.vendor, vendor),
      orderBy: [desc(services.createdAtTs)],
    })
    return json(rows)
  }

  // ── Vendor attestation history ─────────────────────────────────────────────
  const vendorAttestMatch = path.match(/^\/vendor\/(0x[0-9a-fA-F]{40})\/attestations$/)
  if (vendorAttestMatch && req.method === 'GET') {
    const vendor = vendorAttestMatch[1].toLowerCase()
    const rows = await db.query.attestations.findMany({
      where: eq(attestations.vendor, vendor),
      orderBy: [desc(attestations.blockNumber)],
    })
    return json(rows)
  }

  // ── Disputes for a subscriber ──────────────────────────────────────────────
  const disputesMatch = path.match(/^\/disputes\/(0x[0-9a-fA-F]{40})$/)
  if (disputesMatch && req.method === 'GET') {
    const subscriber = disputesMatch[1].toLowerCase()
    const rows = await db.query.disputes.findMany({
      where: eq(disputes.subscriber, subscriber),
      orderBy: [desc(disputes.blockNumber)],
    })
    return json(rows)
  }

  return err('Not found', 404)
}

export function startApiServer() {
  const server = Bun.serve({
    port: PORT,
    fetch: handleRequest,
  })
  console.log(`[api] Listening on http://localhost:${PORT}`)
  return server
}
