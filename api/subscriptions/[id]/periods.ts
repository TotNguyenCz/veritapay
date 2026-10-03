import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../_db.js'
import { syncEvents } from '../../_sync.js'
import { periods } from '../../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  await syncEvents().catch((e) => console.error('[api] sync error:', e))
  try {
    const subId = BigInt(String(req.query.id))
    const rows = await db.query.periods.findMany({
      where: eq(periods.subscriptionId, subId),
      orderBy: [desc(periods.periodIndex)],
    })
    return res.json(ser(rows))
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
