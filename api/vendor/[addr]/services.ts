import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../_db.js'
import { syncEvents } from '../../_sync.js'
import { services } from '../../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  await syncEvents().catch((e) => console.error('[api] sync error:', e))
  try {
    const addr = String(req.query.addr).toLowerCase()
    const rows = await db.query.services.findMany({
      where: eq(services.vendor, addr),
      orderBy: [desc(services.createdAtTs)],
    })
    return res.json(ser(rows))
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
