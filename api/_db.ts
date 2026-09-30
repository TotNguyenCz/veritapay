/**
 * Shared DB client for Vercel Serverless Functions.
 * Each function imports this — connection is reused across warm invocations
 * via module-level singleton (Vercel caches module scope between invocations
 * on the same instance).
 *
 * Uses `pg` (node-postgres) instead of postgres.js because Vercel's Node.js
 * runtime handles pg better than the Bun-oriented postgres.js in some edge
 * cases with connection pooling.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../server/db/schema.js'

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) throw new Error('DATABASE_URL env var is not set')

// Strip Prisma-style ?schema= query param — pg doesn't understand it
const connectionString = rawUrl.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '')

// Parse schema name from original URL
const schemaMatch = rawUrl.match(/[?&]schema=([^&]+)/)
const schemaName = schemaMatch ? schemaMatch[1] : 'VeritaPay'

// Singleton pool — reused across warm lambda invocations
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5, // keep low for serverless (each function has its own pool)
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
    // Set search_path on every new client
    pool.on('connect', (client) => {
      client.query(`SET search_path TO "${schemaName}",public`)
    })
  }
  return pool
}

export const db = drizzle(getPool(), { schema })

/** Serialize BigInt → string for JSON */
export function bigintReplacer(_: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, bigintReplacer), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export function errResponse(msg: string, status = 400) {
  return jsonResponse({ error: msg }, status)
}
