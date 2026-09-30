import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../../_db.js'
import { subscriptions } from '../../../server/db/schema.js'

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/i

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  const id = String(req.query.id)
  try {
    // /api/subscriptions/0x... — all subs for an address
    if (ETH_ADDR.test(id)) {
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.subscriber, id.toLowerCase()),
      })
      return res.json(ser(rows))
    }
    // /api/subscriptions/:numericId
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.subscriptionId, BigInt(id)),
    })
    if (!row) return res.status(404).json({ error: 'Subscription not found' })
    return res.json(ser(row))
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
