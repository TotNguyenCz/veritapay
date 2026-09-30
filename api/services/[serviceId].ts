import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../_db.js'
import { services, subscriptions } from '../../server/db/schema.js'

function ser(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, val) =>
    typeof val === 'bigint' ? val.toString() : val
  ))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { serviceId } = req.query

  // /api/services/:serviceId/subscriptions
  if (req.url?.endsWith('/subscriptions')) {
    try {
      const id = BigInt(String(serviceId))
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.serviceId, id),
        orderBy: [desc(subscriptions.startedAtTs)],
      })
      return res.json(ser(rows))
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }

  // /api/services/:serviceId
  try {
    const id = BigInt(String(serviceId))
    const row = await db.query.services.findFirst({ where: eq(services.serviceId, id) })
    if (!row) return res.status(404).json({ error: 'Service not found' })
    return res.json(ser(row))
  } catch (e) { return res.status(500).json({ error: String(e) }) }
}
