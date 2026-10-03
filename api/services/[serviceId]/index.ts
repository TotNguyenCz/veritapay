import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
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
    const id = BigInt(String(req.query.serviceId))
    const row = await db.query.services.findFirst({ where: eq(services.serviceId, id) })
    if (!row) return res.status(404).json({ error: 'Service not found' })
    return res.json(ser(row))
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
