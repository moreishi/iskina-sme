import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

config({ path: resolve(root, '.env'), quiet: true })
config({ path: resolve(root, '.env.local'), override: true, quiet: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for drizzle-kit')
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
})
