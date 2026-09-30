import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, sql } from 'drizzle-orm'
import { db } from './_db.js'
import { services, subscriptions, periods } from '../server/db/schema.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const [svcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(services)
    const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions)
    const [periodStats] = await db.select({
      settled: sql<number>`count(*) filter (where state = 2)::int`,
      disputed: sql<number>`count(*) filter (where state = 3)::int`,
      missed:   sql<number>`count(*) filter (where state = 5)::int`,
    }).from(periods)
    const [totalUsdc] = await db.select({
      total: sql<string>`coalesce(sum(settled_amount::numeric), 0)::text`,
    }).from(periods).where(eq(periods.state, 2))

    res.json({
      totalServices:       svcCount?.count       ?? 0,
      totalSubscriptions:  subCount?.count        ?? 0,
      periodsSettled:      periodStats?.settled   ?? 0,
      periodsDisputed:     periodStats?.disputed  ?? 0,
      periodsMissed:       periodStats?.missed    ?? 0,
      totalUsdcSettled:    totalUsdc?.total       ?? '0',
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
