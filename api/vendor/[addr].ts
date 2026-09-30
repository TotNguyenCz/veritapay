import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../_db.js'
import { services, attestations } from '../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val
  ))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const addr = String(req.query.addr).toLowerCase()

  // /api/vendor/:addr/services
  if (req.url?.includes('/services')) {
    try {
      const rows = await db.query.services.findMany({
        where: eq(services.vendor, addr),
        orderBy: [desc(services.createdAtTs)],
      })
      return res.json(ser(rows))
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }

  // /api/vendor/:addr/attestations
  if (req.url?.includes('/attestations')) {
    try {
      const rows = await db.query.attestations.findMany({
        where: eq(attestations.vendor, addr),
        orderBy: [desc(attestations.blockNumber)],
      })
      return res.json(ser(rows))
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }

  res.status(404).json({ error: 'Not found' })
}
