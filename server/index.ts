/**
 * VeritaPay backend entry point.
 *
 * 1. Runs Drizzle migrations to ensure schema is up to date.
 * 2. Starts the REST API server on port 3001.
 * 3. Starts the on-chain event indexer (polls every 6s).
 *
 * Start with: bun run server
 */

import { runMigrations } from './db/migrate.js'
import { startApiServer } from './api.js'
import { startIndexer } from './indexer.js'

async function main() {
  console.log('[server] VeritaPay backend starting...')

  // 1. Migrate
  try {
    await runMigrations()
  } catch (err) {
    console.error('[server] Migration failed:', err)
    process.exit(1)
  }

  // 2. API
  startApiServer()

  // 3. Indexer (non-blocking — errors logged, not fatal)
  startIndexer().catch((err) => {
    console.error('[server] Indexer startup error:', err)
  })
}

main()
