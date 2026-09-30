import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../_db.js'
import { subscriptions } from '../../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  try {
    const id = BigInt(String(req.query.serviceId))
    const rows = await db.query.subscriptions.findMany({
      where: eq(subscriptions.serviceId, id),
      orderBy: [desc(subscriptions.startedAtTs)],
    })
    return res.json(ser(rows))
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
