import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../_db.js'
import { subscriptions, periods } from '../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val
  ))
}

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const id = String(req.query.id)

  // /api/subscriptions/:addr  — all subscriptions for an address
  if (ETH_ADDR.test(id)) {
    try {
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.subscriber, id.toLowerCase()),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return res.json(ser(rows))
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }

  // /api/subscriptions/:numericId/periods
  if (req.url?.endsWith('/periods')) {
    try {
      const subId = BigInt(id)
      const rows = await db.query.periods.findMany({
        where: eq(periods.subscriptionId, subId),
        orderBy: [desc(periods.periodIndex)],
      })
      return res.json(ser(rows))
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }

  // /api/subscriptions/:numericId
  try {
    const subId = BigInt(id)
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.subscriptionId, subId),
    })
    if (!row) return res.status(404).json({ error: 'Subscription not found' })
    return res.json(ser(row))
  } catch (e) { return res.status(500).json({ error: String(e) }) }
}
