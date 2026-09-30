import { defineConfig } from 'drizzle-kit'

// Extract schema name from DATABASE_URL ?schema= param
function getSchemaName(): string {
  const url = process.env.DATABASE_URL ?? ''
  const m = url.match(/[?&]schema=([^&]+)/)
  return m ? m[1] : 'VeritaPay'
}

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: [getSchemaName()],
})
