import type { VercelRequest, VercelResponse } from '@vercel/node'
import { desc } from 'drizzle-orm'
import { db } from './_db.js'
import { services } from '../server/db/schema.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const rows = await db.query.services.findMany({
      orderBy: [desc(services.createdAtTs)],
    })
    // Serialize bigints
    res.json(JSON.parse(JSON.stringify(rows, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    )))
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
