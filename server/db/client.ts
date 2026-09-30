/**
 * Drizzle + postgres.js client.
 * Reads DATABASE_URL from process.env (Bun loads .env automatically).
 * Sets search_path to the schema declared in ?schema= so all queries
 * target "VeritaPay".* without requiring fully-qualified table names.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'
import { getSchemaName } from './migrate.js'

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) throw new Error('DATABASE_URL is not set in .env')

// Strip Prisma-style ?schema= query param before passing to postgres.js
// (Postgres rejects unknown configuration parameters at connect time).
const connectionString = rawUrl.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '')

const schemaName = getSchemaName()

// Set search_path on every connection so unqualified table names resolve to
// the correct schema.  We still use fully-qualified names in raw SQL (migrate /
// seed) but Drizzle generates unqualified names when using pgSchema().table().
const sql = postgres(connectionString, {
  max: 10,
  onnotice: () => undefined,   // suppress NOTICE logs from the server
  connection: {
    search_path: `"${schemaName}",public`,
  },
})

export const db = drizzle(sql, { schema })

export type DB = typeof db
